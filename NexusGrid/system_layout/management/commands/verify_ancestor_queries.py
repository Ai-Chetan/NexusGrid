"""
Management command: verify_ancestor_queries
============================================
Proves that get_ancestors() and get_breadcrumb() each fire exactly ONE SQL
query regardless of the tree depth, replacing the old N+1 while-loop.

The command builds a temporary in-memory tree at increasing depths (2, 4, 6, 8
levels), calls the two methods, counts the DB queries issued, and asserts the
count is always 1.  It cleans up after itself inside a rolled-back transaction
so the production database is never modified.

Usage:
    python manage.py verify_ancestor_queries
    python manage.py verify_ancestor_queries --max-depth 10
    python manage.py verify_ancestor_queries --keep   # skip rollback (inspect created rows)
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext

from system_layout.models import LayoutItem


# Tree shape used for testing:
#   Building  (depth 1 ancestor from leaf)
#     Floor   (depth 2)
#       Room  (depth 3)
#         Computer  (depth 4 — the leaf we call get_ancestors() on)
#
# We repeat the pattern to test arbitrary depth chains.

ITEM_TYPE_CYCLE = ["building", "floor", "room", "computer"]


def _build_chain(depth: int) -> list[LayoutItem]:
    """
    Create a linear ancestor chain of `depth` nodes in the DB.
    Returns the list [root, ..., leaf].
    """
    nodes: list[LayoutItem] = []
    parent = None
    for i in range(depth):
        item_type = ITEM_TYPE_CYCLE[i % len(ITEM_TYPE_CYCLE)]
        node = LayoutItem.objects.create(
            name=f"_verify_{i}_{item_type}",
            item_type=item_type,
            parent=parent,
        )
        nodes.append(node)
        parent = node
    return nodes


def _count_queries(fn) -> tuple[int, list]:
    """Run fn(), return (number_of_queries_fired, return_value)."""
    with CaptureQueriesContext(connection) as ctx:
        result = fn()
    return len(ctx.captured_queries), result


class Command(BaseCommand):
    help = (
        "Verify that get_ancestors() and get_breadcrumb() each fire exactly "
        "1 SQL query regardless of tree depth."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-depth",
            type=int,
            default=8,
            metavar="N",
            help="Build chains up to this many levels deep (default: 8).",
        )
        parser.add_argument(
            "--keep",
            action="store_true",
            default=False,
            help="Skip the rollback and leave test rows in the database.",
        )

    def handle(self, *args, **options):
        max_depth: int = options["max_depth"]
        keep: bool = options["keep"]
        depths_to_test = [d for d in range(2, max_depth + 1, 2)]

        self.stdout.write(self.style.MIGRATE_HEADING(
            "\nAncestor query-count verification\n"
            "─────────────────────────────────"
        ))
        self.stdout.write(
            f"  Testing depths : {depths_to_test}\n"
            f"  Rollback data  : {'NO (--keep)' if keep else 'YES'}\n"
        )

        all_passed = True

        # Wrap everything in a savepoint so we can roll back test data cleanly.
        with transaction.atomic():
            sp = transaction.savepoint()

            for depth in depths_to_test:
                nodes = _build_chain(depth)
                leaf = nodes[-1]   # deepest node
                root = nodes[0]

                # ── Test 1: get_ancestors() on the leaf ────────────────────
                q_count, ancestors = _count_queries(lambda: leaf.get_ancestors())

                ok_ancestors = (q_count == 1) and (len(ancestors) == depth - 1)
                symbol = self.style.SUCCESS("  PASS") if ok_ancestors else self.style.ERROR("  FAIL")
                self.stdout.write(
                    f"{symbol}  depth={depth:>2}  get_ancestors()   "
                    f"queries={q_count}  ancestors_returned={len(ancestors)}"
                    f"  (expected 1 query, {depth - 1} ancestors)"
                )

                # ── Test 2: get_breadcrumb() on the leaf's pk ──────────────
                q_count_bc, crumbs = _count_queries(
                    lambda: LayoutItem.get_breadcrumb(leaf.pk)
                )

                ok_crumbs = (q_count_bc == 1) and (len(crumbs) == depth)
                symbol = self.style.SUCCESS("  PASS") if ok_crumbs else self.style.ERROR("  FAIL")
                self.stdout.write(
                    f"{symbol}  depth={depth:>2}  get_breadcrumb()  "
                    f"queries={q_count_bc}  crumbs_returned={len(crumbs)}"
                    f"  (expected 1 query, {depth} crumbs)"
                )

                # ── Test 3: root node (no ancestors — 0 DB queries) ────────
                q_count_root, ancestors_root = _count_queries(lambda: root.get_ancestors())
                ok_root = (q_count_root == 0) and (ancestors_root == [])
                symbol = self.style.SUCCESS("  PASS") if ok_root else self.style.ERROR("  FAIL")
                self.stdout.write(
                    f"{symbol}  depth={depth:>2}  get_ancestors()   "
                    f"queries={q_count_root}  [ROOT NODE — should skip DB entirely]"
                )

                if not (ok_ancestors and ok_crumbs and ok_root):
                    all_passed = False

            if keep:
                transaction.savepoint_commit(sp)
                self.stdout.write(self.style.WARNING(
                    "\n  Test rows committed (--keep was set). "
                    "Run cleanup manually:\n"
                    "    LayoutItem.objects.filter(name__startswith='_verify_').delete()\n"
                ))
            else:
                transaction.savepoint_rollback(sp)
                self.stdout.write("  Test rows rolled back — database unchanged.\n")

        # ── Final verdict ──────────────────────────────────────────────────
        if all_passed:
            self.stdout.write(self.style.SUCCESS(
                "\n✓ All assertions passed — ancestor queries are O(1) SQL.\n"
            ))
        else:
            self.stdout.write(self.style.ERROR(
                "\n✗ One or more assertions failed — see FAIL lines above.\n"
            ))
            raise SystemExit(1)
