"""
Wipe layout / faults / resources / lab-assignment data and repopulate with dummy data.

Usage:
    python manage.py seed_dummy_data

Preserves: superusers and Administrator accounts. Everything else that this
command touches (layout items, labs, systems, fault reports, resource
requests, lab assignments, demo incharge/assistant users) is deleted and
recreated.
"""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from faults.models import FaultReport
from login_manager.models import User
from resources.models import ResourceRequest
from system_layout.models import Lab, LabAssignment, LayoutItem, System

DEMO_PASSWORD = 'nexus1234'

FAULT_DESCRIPTIONS = {
    'Hardware': [
        'Monitor flickering intermittently.',
        'Keyboard keys not responding.',
        'Mouse left click faulty.',
        'System randomly powers off.',
        'RAM module failure suspected.',
    ],
    'Software': [
        'OS fails to boot after update.',
        'Compiler not installed on this machine.',
        'Antivirus blocking lab software.',
        'License expired for IDE.',
        'System extremely slow after login.',
    ],
    'Network': [
        'No internet connectivity.',
        'LAN port not working.',
        'Very high latency to server.',
        'IP conflict detected.',
        'Wi-Fi adapter not detected.',
    ],
}

RESOURCES = [
    ('Spare Mouse', 'Optical USB mouse replacement needed.'),
    ('Keyboard', 'Replacement keyboard for damaged unit.'),
    ('HDMI Cable', 'Cable required for projector connection.'),
    ('RAM 8GB', 'Memory upgrade for slow system.'),
    ('SSD 256GB', 'Disk replacement for failing drive.'),
    ('LAN Cable', 'Cat6 patch cable needed.'),
    ('Power Strip', 'Extra power outlets for workstations.'),
    ('Webcam', 'Camera for online exam proctoring.'),
]


class Command(BaseCommand):
    help = 'Wipe and repopulate layout, faults, resources, and lab assignments with dummy data.'

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(42)  # deterministic seed → repeatable data
        now = timezone.now()

        # ── 1. Wipe ───────────────────────────────────────────────────────
        FaultReport.objects.all().delete()
        ResourceRequest.objects.all().delete()
        LabAssignment.objects.all().delete()
        System.objects.all().delete()
        Lab.objects.all().delete()
        LayoutItem.objects.all().delete()
        self.stdout.write('Wiped layout items, labs, systems, faults, resources, assignments.')

        # ── 2. Demo users (incharges + assistants) ────────────────────────
        def make_user(username, role):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={'email': f'{username}@nexusgrid.local', 'role': role},
            )
            user.role = role
            user.set_password(DEMO_PASSWORD)
            user.save()
            return user

        incharges  = [make_user(f'incharge{i}',  'Lab Incharge')  for i in range(1, 5)]
        assistants = [make_user(f'assistant{i}', 'Lab Assistant') for i in range(1, 4)]
        admin = User.objects.filter(role='Administrator').first()
        self.stdout.write(f'Users ready: {len(incharges)} incharges, {len(assistants)} assistants '
                          f'(password: {DEMO_PASSWORD})')

        # ── 3. Layout: buildings → floors → rooms(labs) → devices ─────────
        systems: list[System] = []
        labs: list[Lab] = []

        buildings = [('Main Block', 'A'), ('CS Block', 'B')]
        for b_idx, (b_name, b_code) in enumerate(buildings):
            building = LayoutItem.objects.create(
                name=b_name, item_type='building',
                position_x=b_idx * 6, position_y=0, width=5, height=4,
            )
            for f_num in (1, 2):
                floor = LayoutItem.objects.create(
                    name=f'Floor {f_num}', item_type='floor', parent=building,
                    position_x=0, position_y=(f_num - 1) * 5, width=5, height=4,
                )
                for r_num in (1, 2):
                    room_no = f'{f_num}0{r_num}'
                    room = LayoutItem.objects.create(
                        name=f'Lab {b_code}{room_no}', item_type='room', parent=floor,
                        position_x=(r_num - 1) * 6, position_y=0, width=5, height=4,
                    )
                    lab = Lab.objects.create(
                        layout_item=room,
                        lab_name=f'{b_name} Lab {b_code}{room_no}',
                        lab_code=f'LAB-{b_code}{room_no}',
                        location=f'{b_name}, Floor {f_num}',
                        capacity=30,
                        dimension='10m x 8m',
                        quick_info={'projector': True, 'ac': f_num == 1},
                    )
                    labs.append(lab)

                    # 6 computers per lab in a 3x2 grid + 1 printer
                    for i in range(6):
                        pc = LayoutItem.objects.create(
                            name=f'{b_code}{room_no}-PC{i + 1:02d}',
                            item_type='computer', parent=room,
                            position_x=i % 3, position_y=i // 3,
                        )
                        systems.append(System.objects.create(
                            layout_item=pc, lab=lab,
                            host_name=pc.name,
                            status=rng.choice(['active'] * 7 + ['inactive'] * 2 + ['non-functional']),
                            updated_at=now,
                        ))
                    printer = LayoutItem.objects.create(
                        name=f'{b_code}{room_no}-PRN', item_type='printer', parent=room,
                        position_x=4, position_y=0,
                    )
                    systems.append(System.objects.create(
                        layout_item=printer, lab=lab,
                        host_name=printer.name, status='active', updated_at=now,
                    ))

        self.stdout.write(f'Created {len(labs)} labs and {len(systems)} systems.')

        # ── 4. Lab assignments (one incharge + one assistant per lab) ─────
        for idx, lab in enumerate(labs):
            LabAssignment.objects.create(
                lab=lab, user=incharges[idx % len(incharges)],
                role_type='incharge', assigned_by=admin,
            )
            LabAssignment.objects.create(
                lab=lab, user=assistants[idx % len(assistants)],
                role_type='assistant', assigned_by=admin,
            )
        self.stdout.write(f'Created {len(labs) * 2} lab assignments.')

        # ── 5. Fault reports (spread over the last 90 days) ───────────────
        statuses = ['unaddressed'] * 3 + ['in-progress'] * 2 + ['scheduled'] + ['resolved'] * 3 + ['ignored']
        faults_created = 0
        for _ in range(24):
            system = rng.choice(systems)
            ftype = rng.choice(list(FAULT_DESCRIPTIONS))
            status = rng.choice(statuses)
            fault = FaultReport.objects.create(
                system_name=system,
                reported_by=rng.choice(incharges),
                fault_type=ftype,
                risk_factor=rng.randint(1, 5),
                description=rng.choice(FAULT_DESCRIPTIONS[ftype]),
                status=status,
            )
            reported_at = now - timedelta(days=rng.randint(0, 90), hours=rng.randint(0, 12))
            update = {'reported_at': reported_at}
            if status == 'resolved':
                resolver = rng.choice(assistants + ([admin] if admin else []))
                update.update({
                    'resolution_summary': 'Issue fixed and verified working.',
                    'resolved_by': resolver,
                    'resolved_at': reported_at + timedelta(days=rng.randint(0, 5)),
                })
            FaultReport.objects.filter(pk=fault.pk).update(**update)
            faults_created += 1
        self.stdout.write(f'Created {faults_created} fault reports.')

        # ── 6. Resource requests ──────────────────────────────────────────
        rr_statuses = ['Pending'] * 4 + ['Fulfilled'] * 4 + ['Denied']
        rr_created = 0
        for _ in range(18):
            system = rng.choice(systems)
            name, desc = rng.choice(RESOURCES)
            status = rng.choice(rr_statuses)
            rr = ResourceRequest.objects.create(
                system_name=system,
                requested_by=rng.choice(incharges + assistants),
                resource_name=name,
                description=desc,
                quantity=rng.randint(1, 5),
                status=status,
            )
            requested_at = now - timedelta(days=rng.randint(0, 90), hours=rng.randint(0, 12))
            update = {'requested_at': requested_at}
            if status == 'Fulfilled':
                provider = rng.choice(assistants + ([admin] if admin else []))
                update.update({
                    'provision_summary': 'Item provided from lab inventory.',
                    'provided_by': provider,
                    'provided_at': requested_at + timedelta(days=rng.randint(0, 7)),
                    'cost': rng.choice([150, 300, 450, 800, 1500, 2500]),
                })
            ResourceRequest.objects.filter(pk=rr.pk).update(**update)
            rr_created += 1
        self.stdout.write(f'Created {rr_created} resource requests.')

        self.stdout.write(self.style.SUCCESS('Dummy data seeded successfully.'))