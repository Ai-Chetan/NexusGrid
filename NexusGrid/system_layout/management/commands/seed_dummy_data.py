"""
Wipe layout / faults / resources / lab-assignment data and repopulate with
rich dummy data for fault reports and resource requests analysis.

Usage:
    python manage.py seed_dummy_data

Only uses three accounts: ChetanAdmin, ChetanIncharge, ChetanAssistant.
"""

import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from faults.models import FaultReport
from login_manager.models import User
from monitoring.models import SystemCurrent, SystemInfo
from resources.models import ResourceRequest
from system_layout.models import Lab, LabAssignment, LayoutItem, PrivilegesConfig, System

DEMO_PASSWORD = 'Pass@123'

FAULT_DESCRIPTIONS = {
    'Hardware': [
        'RAM module failure detected; system shows BSOD on boot.',
        'Hard drive making clicking noises; SMART status critical.',
        'Power supply unit not delivering stable voltage.',
        'Keyboard keys unresponsive; multiple keys stuck.',
        'Monitor displaying flickering and color distortion.',
        'CPU overheating; thermal paste dried out.',
        'USB ports not recognizing any connected devices.',
        'Motherboard capacitor bulging observed.',
        'GPU artifacting under load; VRAM failure suspected.',
        'Fan bearing worn out; excessive noise during operation.',
    ],
    'Software': [
        'OS fails to boot after Windows update; stuck in recovery loop.',
        'Antivirus quarantined critical system files; applications crashing.',
        'Database service not starting; corrupted configuration file.',
        'IDE license expired; students unable to compile projects.',
        'Python environment broken after pip upgrade; dependency conflicts.',
        'Group policy misconfiguration blocking internet access.',
        'Scheduled task failing silently; backup not running.',
        'Application crash on launch; missing .NET framework version.',
        'DNS resolution failing intermittently on this workstation.',
        'Disk encryption software causing 10-minute boot delay.',
    ],
    'Network': [
        'Ethernet port not negotiating above 100 Mbps.',
        'Intermittent packet loss; ping shows 15-20% drops.',
        'VLAN misconfiguration; system on wrong subnet.',
        'Wi-Fi adapter driver crash; no wireless connectivity.',
        'Switch port flapping; link goes up/down every 30 seconds.',
        'DHCP lease not renewing; stale IP causing conflicts.',
        'Firewall rule blocking required application ports.',
        'DNS server unreachable; fallback to public DNS failing.',
        'Network cable damaged; CRC errors on interface.',
        'Proxy authentication failing for lab internet access.',
    ],
}

RESOLUTION_SUMMARIES = [
    'Replaced faulty component and verified system stability over 24 hours.',
    'Reinstalled OS and restored user data from backup.',
    'Updated firmware and applied latest security patches.',
    'Reconfigured network settings; verified connectivity with traceroute.',
    'Replaced damaged cable and re-crimped connectors.',
    'Rolled back problematic update; applied fix from vendor KB article.',
    'Cleaned hardware, reapplied thermal paste, and stress-tested.',
    'Restored from system image; reconfigured application settings.',
    'Replaced PSU with higher wattage unit; load tested successfully.',
    'Reset switch port configuration; verified VLAN membership.',
]

RESOURCES = [
    ('8GB DDR4 RAM Module', 'Upgrade RAM for programming lab workstations to handle IDE + VM workloads.', Decimal('2499.00')),
    ('256GB NVMe SSD', 'Replace aging HDDs to improve boot and application load times.', Decimal('3299.00')),
    ('Cat6 Ethernet Cable (3m)', 'Replace damaged network cables in networking lab.', Decimal('350.00')),
    ('Wireless Mouse', 'Replace non-functional mice across lab workstations.', Decimal('599.00')),
    ('Mechanical Keyboard', 'Replace keyboards with stuck/unresponsive keys.', Decimal('1899.00')),
    ('24-port Gigabit Switch', 'Expand network capacity for new lab section.', Decimal('12999.00')),
    ('UPS Battery Replacement', 'Replace degraded UPS batteries in server room.', Decimal('4500.00')),
    ('Thermal Paste (Arctic MX-4)', 'Restock thermal paste for CPU maintenance.', Decimal('549.00')),
    ('HDMI Cable (2m)', 'Replace faulty display cables for projector connections.', Decimal('449.00')),
    ('USB-C Hub (7-in-1)', 'Provide connectivity options for newer laptop-based workstations.', Decimal('2199.00')),
    ('1TB SATA SSD', 'Additional storage for database lab server.', Decimal('7499.00')),
    ('Network Crimping Tool Kit', 'For student practical sessions on cable termination.', Decimal('1299.00')),
    ('Surge Protector (6-outlet)', 'Protect sensitive equipment from voltage spikes.', Decimal('1899.00')),
    ('Monitor Stand Riser', 'Ergonomic improvement for lab workstations.', Decimal('999.00')),
    ('Toner Cartridge (HP 26A)', 'Replace empty toner in lab printer.', Decimal('5499.00')),
]


class Command(BaseCommand):
    help = 'Wipe and repopulate layout, faults, resources, and lab assignments with rich dummy data using Chetan accounts.'

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(42)  # deterministic seed → repeatable data
        now = timezone.now()

        # ── 1. Wipe ───────────────────────────────────────────────────────
        FaultReport.objects.all().delete()
        ResourceRequest.objects.all().delete()
        SystemInfo.objects.all().delete()
        SystemCurrent.objects.all().delete()
        LabAssignment.objects.all().delete()
        System.objects.all().delete()
        Lab.objects.all().delete()
        LayoutItem.objects.all().delete()
        PrivilegesConfig.objects.all().delete()
        # Remove all users except the three Chetan accounts.
        # First clear any FK references from rbac_userrole (legacy table).
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rbac_userrole')"
            )
            if cursor.fetchone()[0]:
                cursor.execute("DELETE FROM rbac_userrole")
        User.objects.exclude(
            username__in=['ChetanAdmin', 'ChetanIncharge', 'ChetanAssistant']
        ).delete()
        self.stdout.write('Wiped layout items, labs, systems, faults, resources, assignments, monitoring data.')

        # ── 2. Create/ensure the three Chetan users ───────────────────────
        admin, _ = User.objects.get_or_create(
            username='ChetanAdmin',
            defaults={
                'email': 'chetan.admin@nexusgrid.edu',
                'role': 'Administrator',
                'is_staff': True,
                'is_superuser': True,
            },
        )
        admin.role = 'Administrator'
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password(DEMO_PASSWORD)
        admin.save()

        incharge, _ = User.objects.get_or_create(
            username='ChetanIncharge',
            defaults={
                'email': 'chetan.incharge@nexusgrid.edu',
                'role': 'Lab Incharge',
                'is_staff': True,
            },
        )
        incharge.role = 'Lab Incharge'
        incharge.is_staff = True
        incharge.set_password(DEMO_PASSWORD)
        incharge.save()

        assistant, _ = User.objects.get_or_create(
            username='ChetanAssistant',
            defaults={
                'email': 'chetan.assistant@nexusgrid.edu',
                'role': 'Lab Assistant',
                'is_staff': False,
            },
        )
        assistant.role = 'Lab Assistant'
        assistant.is_staff = False
        assistant.set_password(DEMO_PASSWORD)
        assistant.save()

        self.stdout.write(self.style.SUCCESS(
            f'Users ready: ChetanAdmin (Administrator), ChetanIncharge (Lab Incharge), '
            f'ChetanAssistant (Lab Assistant) — password: {DEMO_PASSWORD}'
        ))

        # ── 3. Layout: building → floors → rooms(labs) → devices ─────────
        systems: list[System] = []
        labs: list[Lab] = []

        building = LayoutItem.objects.create(
            name='Main Academic Block', item_type='building',
            position_x=0, position_y=0, width=12, height=10,
        )

        lab_configs = [
            ('Floor 1', 'Lab 101 - Programming', 'LAB-101', 40, '12m x 8m'),
            ('Floor 1', 'Lab 102 - Networking', 'LAB-102', 30, '10m x 8m'),
            ('Floor 2', 'Lab 201 - AI/ML', 'LAB-201', 35, '12m x 9m'),
            ('Floor 2', 'Lab 202 - Database', 'LAB-202', 30, '10m x 8m'),
            ('Floor 3', 'Lab 301 - IoT & Embedded', 'LAB-301', 25, '8m x 8m'),
            ('Floor 3', 'Server Room', 'SRV-301', 5, '6m x 5m'),
        ]

        floor_cache: dict[str, LayoutItem] = {}
        for idx, (floor_name, lab_name, lab_code, capacity, dimension) in enumerate(lab_configs):
            if floor_name not in floor_cache:
                floor_cache[floor_name] = LayoutItem.objects.create(
                    name=floor_name, item_type='floor', parent=building,
                    position_x=0, position_y=len(floor_cache) * 6, width=12, height=5,
                )
            floor = floor_cache[floor_name]

            room = LayoutItem.objects.create(
                name=lab_name, item_type='room', parent=floor,
                position_x=(idx % 2) * 7, position_y=0, width=5, height=4,
            )
            lab = Lab.objects.create(
                layout_item=room,
                lab_name=lab_name,
                lab_code=lab_code,
                location=f'Main Academic Block, {floor_name}',
                capacity=capacity,
                dimension=dimension,
                quick_info={'projector': True, 'whiteboard': True, 'ac': True, 'cctv': True},
            )
            lab.instructors.add(incharge)
            lab.assistants.add(assistant)
            labs.append(lab)

            # Systems per lab
            is_server_room = lab_code == 'SRV-301'
            pc_count = 2 if is_server_room else rng.randint(6, 12)
            for i in range(pc_count):
                item_type = 'server' if is_server_room and i < 2 else 'computer'
                pc = LayoutItem.objects.create(
                    name=f'{lab_code}-{item_type.upper()}{i + 1:02d}',
                    item_type=item_type, parent=room,
                    position_x=i % 4, position_y=i // 4,
                )
                systems.append(System.objects.create(
                    layout_item=pc, lab=lab,
                    host_name=f'NG-{len(systems) + 1:04d}',
                    status=rng.choices(['active', 'inactive', 'non-functional'], weights=[75, 15, 10])[0],
                    updated_at=now, updated_by=admin,
                ))

            # Peripherals
            for ptype in ['printer', 'network_switch', 'ups']:
                if is_server_room or ptype != 'network_switch' or rng.random() > 0.4:
                    dev = LayoutItem.objects.create(
                        name=f'{lab_code}-{ptype.upper()}',
                        item_type=ptype, parent=room,
                        position_x=5, position_y=0,
                    )
                    systems.append(System.objects.create(
                        layout_item=dev, lab=lab,
                        host_name=f'NG-{len(systems) + 1:04d}',
                        status=rng.choices(['active', 'inactive', 'non-functional'], weights=[80, 12, 8])[0],
                        updated_at=now, updated_by=admin,
                    ))

        self.stdout.write(f'Created {len(labs)} labs and {len(systems)} systems.')

        # ── 4. Lab assignments ────────────────────────────────────────────
        for lab in labs:
            LabAssignment.objects.create(
                lab=lab, user=incharge,
                role_type='incharge', assigned_by=admin,
                start_date=(now - timedelta(days=180)).date(),
            )
            LabAssignment.objects.create(
                lab=lab, user=assistant,
                role_type='assistant', assigned_by=admin,
                start_date=(now - timedelta(days=180)).date(),
            )
        self.stdout.write(f'Created {len(labs) * 2} lab assignments.')

        # ── 5. Fault reports (120 reports over 180 days) ──────────────────
        fault_statuses = ['unaddressed', 'in-progress', 'scheduled', 'resolved', 'ignored']
        fault_weights = [15, 20, 10, 45, 10]
        reporters = [admin, incharge, assistant]
        faults_created = 0

        for _ in range(120):
            system = rng.choice(systems)
            ftype = rng.choice(list(FAULT_DESCRIPTIONS))
            status = rng.choices(fault_statuses, weights=fault_weights)[0]
            risk = rng.choices([1, 2, 3, 4, 5], weights=[10, 20, 35, 25, 10])[0]
            reporter = rng.choice(reporters)

            days_ago = rng.randint(0, 180)
            reported_at = now - timedelta(days=days_ago, hours=rng.randint(0, 23), minutes=rng.randint(0, 59))

            fault = FaultReport.objects.create(
                system_name=system,
                reported_by=reporter,
                fault_type=ftype,
                risk_factor=risk,
                description=rng.choice(FAULT_DESCRIPTIONS[ftype]),
                status=status,
            )

            update = {'reported_at': reported_at}
            if status == 'resolved':
                resolver = rng.choice([incharge, assistant])
                resolved_at = reported_at + timedelta(hours=rng.randint(2, 72), minutes=rng.randint(0, 59))
                if resolved_at > now:
                    resolved_at = now - timedelta(hours=rng.randint(1, 24))
                update.update({
                    'resolution_summary': rng.choice(RESOLUTION_SUMMARIES),
                    'resolved_by': resolver,
                    'resolved_at': resolved_at,
                })
            FaultReport.objects.filter(pk=fault.pk).update(**update)
            faults_created += 1

        self.stdout.write(f'Created {faults_created} fault reports (spread over 180 days).')

        # ── 6. Resource requests (60 requests over 180 days) ──────────────
        rr_statuses = ['Pending', 'Fulfilled', 'Denied']
        rr_weights = [25, 55, 20]
        requesters = [incharge, assistant]
        rr_created = 0

        for _ in range(60):
            system = rng.choice(systems)
            res_name, res_desc, res_cost = rng.choice(RESOURCES)
            status = rng.choices(rr_statuses, weights=rr_weights)[0]
            requester = rng.choice(requesters)
            quantity = rng.choices([1, 2, 3, 5, 10], weights=[40, 25, 15, 12, 8])[0]

            days_ago = rng.randint(0, 180)
            requested_at = now - timedelta(days=days_ago, hours=rng.randint(0, 23), minutes=rng.randint(0, 59))

            rr = ResourceRequest.objects.create(
                system_name=system,
                requested_by=requester,
                resource_name=res_name,
                description=res_desc,
                quantity=quantity,
                cost=res_cost if status == 'Fulfilled' else None,
                status=status,
            )

            update = {'requested_at': requested_at}
            if status == 'Fulfilled':
                provided_at = requested_at + timedelta(days=rng.randint(1, 14), hours=rng.randint(0, 12))
                if provided_at > now:
                    provided_at = now - timedelta(hours=rng.randint(1, 48))
                update.update({
                    'provision_summary': f'Procured {quantity}x {res_name}. Installed and verified on {system.host_name}.',
                    'provided_by': admin,
                    'provided_at': provided_at,
                })
            ResourceRequest.objects.filter(pk=rr.pk).update(**update)
            rr_created += 1

        self.stdout.write(f'Created {rr_created} resource requests (spread over 180 days).')

        # ── 7. Monitoring data (last 7 days for 20 systems) ───────────────
        monitored = [s for s in systems if s.host_name][:20]
        mon_count = 0

        for system in monitored:
            hostname = system.host_name
            is_online = system.status == 'active'

            SystemCurrent.objects.update_or_create(
                hostname_key=hostname.lower(),
                defaults={
                    'hostname': hostname,
                    'last_seen_at': (
                        now - timedelta(minutes=rng.randint(1, 120)) if is_online
                        else now - timedelta(days=rng.randint(1, 7))
                    ),
                    'health_state': 'online' if is_online else rng.choice(['offline', 'unknown']),
                },
            )

            for day in range(7):
                for hour_offset in [0, 6, 12, 18]:
                    ts = now - timedelta(days=day, hours=hour_offset)
                    if ts > now:
                        continue
                    SystemInfo.objects.create(
                        hostname=hostname,
                        ip_address=f'192.168.{rng.randint(1, 5)}.{rng.randint(2, 254)}',
                        system=rng.choice(['Windows', 'Linux']),
                        version=rng.choice(['11 Pro', '10 Enterprise', 'Ubuntu 22.04', 'Fedora 39']),
                        release=rng.choice(['22H2', '21H2', '5.15.0', '6.6.0']),
                        machine='x86_64',
                        processor=rng.choice(['Intel Core i5-12400', 'Intel Core i7-13700', 'AMD Ryzen 5 5600X', 'Intel Xeon E-2388G']),
                        architecture='64bit',
                        cpu_physical_cores=rng.choice([4, 6, 8]),
                        cpu_total_cores=rng.choice([8, 12, 16]),
                        cpu_max_freq=rng.choice([3600.0, 4200.0, 4900.0]),
                        cpu_min_freq=800.0,
                        cpu_current_freq=rng.uniform(1200.0, 4500.0),
                        cpu_usage=rng.uniform(5.0, 95.0),
                        cpu_load_avg=[rng.uniform(0.5, 4.0), rng.uniform(0.5, 3.5), rng.uniform(0.5, 3.0)],
                        memory_total=rng.choice([8.0, 16.0, 32.0]),
                        memory_available=rng.uniform(1.0, 12.0),
                        memory_used=rng.uniform(3.0, 28.0),
                        memory_usage_percent=rng.uniform(20.0, 90.0),
                        swap_total=rng.choice([4.0, 8.0, 16.0]),
                        swap_used=rng.uniform(0.0, 4.0),
                        swap_usage_percent=rng.uniform(0.0, 50.0),
                        disk_total=rng.choice([256.0, 512.0, 1024.0]),
                        disk_used=rng.uniform(50.0, 800.0),
                        disk_free=rng.uniform(20.0, 500.0),
                        disk_usage_percent=rng.uniform(20.0, 90.0),
                        disk_read_bytes=rng.randint(100_000_000, 50_000_000_000),
                        disk_write_bytes=rng.randint(50_000_000, 30_000_000_000),
                        bytes_sent=rng.randint(1_000_000_000, 100_000_000_000),
                        bytes_received=rng.randint(2_000_000_000, 200_000_000_000),
                        users_count=rng.randint(0, 3),
                        logged_in_users=f'user{rng.randint(1, 50)}',
                        gpu_available=rng.choice([True, False]),
                        gpu_stats={'name': 'NVIDIA GTX 1660', 'utilization': rng.uniform(0, 100)} if rng.random() > 0.5 else None,
                        top_processes=[
                            {'name': 'chrome.exe', 'cpu': rng.uniform(1, 25), 'mem': rng.uniform(100, 800)},
                            {'name': 'code.exe', 'cpu': rng.uniform(1, 15), 'mem': rng.uniform(200, 1200)},
                            {'name': 'python.exe', 'cpu': rng.uniform(0.5, 30), 'mem': rng.uniform(50, 500)},
                        ],
                    )
                    mon_count += 1

        self.stdout.write(f'Created {mon_count} monitoring snapshots (20 hosts × 7 days).')

        # ── 8. Privileges config ──────────────────────────────────────────
        PrivilegesConfig.get_config()

        self.stdout.write(self.style.SUCCESS('✓ Dummy data seeded successfully!'))
        self.stdout.write(self.style.SUCCESS(
            f'  Login: ChetanAdmin / ChetanIncharge / ChetanAssistant — password: {DEMO_PASSWORD}'
        ))
