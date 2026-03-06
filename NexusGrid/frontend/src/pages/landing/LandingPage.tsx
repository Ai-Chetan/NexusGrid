import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Monitor, AlertTriangle, Package, Map, Users, BarChart3,
  Shield, CheckCircle, ChevronLeft, ChevronRight, ArrowRight,
  Mail, Phone, MapPin, Clock, Star, Activity, Network,
  Cpu, Layers, Bell, Lock, Globe, TrendingUp, X, Menu,
  Send, Building2, Github, Twitter, Linkedin, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  bg: string;
  points: string[];
}

interface Advantage {
  icon: React.ElementType;
  title: string;
  description: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES: Feature[] = [
  {
    icon: Activity,
    title: 'Real-Time System Monitoring',
    description:
      'Track every machine across all labs live. CPU, memory, disk, and OS info are collected automatically by background agents running on each host.',
    color: 'text-blue-600',
    bg: 'from-blue-50 to-white',
    points: [
      'Live CPU, RAM & Disk metrics',
      'Automatic agent-based data collection',
      'Timeline history with anomaly detection',
      'Multi-lab visibility from one dashboard',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Fault Reporting & Tracking',
    description:
      'Students and staff can log hardware, software, or network faults directly. Each report is assigned, tracked, and resolved with a full audit trail.',
    color: 'text-amber-600',
    bg: 'from-amber-50 to-white',
    points: [
      'Structured fault categorisation (HW/SW/Net)',
      'Priority assignment & status workflow',
      'Resolution notes & closure confirmation',
      'SMS / email alert integrations',
    ],
  },
  {
    icon: Package,
    title: 'Resource Management',
    description:
      'Manage lab equipment requests end-to-end. Students submit requests, staff approve or reject them, and inventory is updated automatically.',
    color: 'text-emerald-600',
    bg: 'from-emerald-50 to-white',
    points: [
      'Request submission & approval workflow',
      'Inventory tracking per lab',
      'Provision & return lifecycle',
      'Usage analytics over time',
    ],
  },
  {
    icon: Map,
    title: 'Interactive Lab Layout',
    description:
      'Build drag-and-drop floor plans for every building, floor, and room. See each machine\'s live status overlaid directly on the map.',
    color: 'text-violet-600',
    bg: 'from-violet-50 to-white',
    points: [
      'Hierarchical building → floor → room → device',
      'Drag-and-drop canvas editor',
      'Live status colours on the map',
      'Quick-info tooltips per device',
    ],
  },
  {
    icon: Users,
    title: 'Role-Based Access Control',
    description:
      'Granular permissions for Administrators, Lab Incharges, Lab Assistants, and Students ensure everyone sees exactly what they need.',
    color: 'text-rose-600',
    bg: 'from-rose-50 to-white',
    points: [
      'Five built-in roles out of the box',
      'Scoped access per lab or system',
      'Audit log for sensitive actions',
      'JWT token authentication',
    ],
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    description:
      'Generate PDF/CSV reports on faults, uptime, resource utilisation, and more. Scheduled or on-demand — the data is always at your fingertips.',
    color: 'text-cyan-600',
    bg: 'from-cyan-50 to-white',
    points: [
      'Fault trends & resolution-time analytics',
      'Per-lab & cross-lab comparisons',
      'Exportable PDF and CSV outputs',
      'Recharts-powered visual dashboards',
    ],
  },
];

const ADVANTAGES: Advantage[] = [
  {
    icon: Network,
    title: 'Unified Single Platform',
    description:
      'Monitoring, faults, resources, layouts and users all live in one system. No more juggling five different tools.',
  },
  {
    icon: Cpu,
    title: 'Agent-Based Collection',
    description:
      'Lightweight Python agents run on each machine and push telemetry automatically—no manual data entry needed.',
  },
  {
    icon: Layers,
    title: 'Visual Spatial Awareness',
    description:
      'The interactive floor-plan lets you pinpoint a failing machine on a map in seconds, not minutes of searching.',
  },
  {
    icon: Bell,
    title: 'Proactive Alerts',
    description:
      'Get notified before problems become outages. Thresholds and fault triggers fire alerts the moment something goes wrong.',
  },
  {
    icon: Lock,
    title: 'Secure by Design',
    description:
      'JWT authentication, CSRF protection, role-scoped APIs and full audit trails ensure data is always protected.',
  },
  {
    icon: Globe,
    title: 'Multi-Lab, Multi-Campus',
    description:
      'Manage dozens of labs across multiple buildings from a single admin account without any extra configuration.',
  },
  {
    icon: TrendingUp,
    title: 'Actionable Insights',
    description:
      'Rich analytics highlight recurring faults, bottlenecks, and underutilised resources so you can act, not just react.',
  },
  {
    icon: Star,
    title: 'Built for Academia',
    description:
      'Designed with real university lab workflows in mind—student requests, instructor oversight, admin governance.',
  },
];

const COMPARISONS = [
  { label: 'Live system monitoring', nexus: true, others: false },
  { label: 'Interactive lab floor plan', nexus: true, others: false },
  { label: 'Integrated fault tracking', nexus: true, others: false },
  { label: 'Resource request workflow', nexus: true, others: false },
  { label: 'Role-based access for 5 roles', nexus: true, others: false },
  { label: 'Auto agent-based data collection', nexus: true, others: false },
  { label: 'Multi-lab / multi-campus support', nexus: true, others: true },
  { label: 'PDF & CSV report export', nexus: true, others: true },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ onNav }: { onNav: (id: string) => void }) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { label: 'Features', id: 'features' },
    { label: 'Why NexusGrid', id: 'why' },
    { label: 'Contact', id: 'contact' },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 shadow-md'
          : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/40">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">NexusGrid</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => onNav(l.id)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-2">
          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-colors shadow-lg shadow-brand-600/30"
          >
            Get Started
          </button>
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="md:hidden flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700 px-4 pb-4">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => { onNav(l.id); setOpen(false); }}
              className="block w-full text-left px-3 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => navigate('/login')}
            className="mt-3 w-full py-2.5 text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-colors"
          >
            Get Started
          </button>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onNav }: { onNav: (id: string) => void }) {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden
                        bg-gradient-to-br from-white via-slate-50 to-brand-50
                        dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      {/* Animated grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />
      {/* Glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-200/40 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-200/30 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-100/50 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-50 dark:bg-slate-800 border border-brand-200 dark:border-slate-700
                        rounded-full text-brand-600 dark:text-brand-400 text-xs font-semibold mb-8">
          <Zap className="w-3.5 h-3.5" />
          Next-Gen Lab Management Platform
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-tight tracking-tight mb-6">
          Manage Every Lab,{' '}
          <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-violet-600 bg-clip-text text-transparent">
            Every System,
          </span>
          <br />
          From One Dashboard
        </h1>

        <p className="text-lg sm:text-xl text-slate-500 max-w-3xl mx-auto mb-10 leading-relaxed">
          NexusGrid gives universities and institutions a single, intelligent platform to monitor systems in real time,
          track faults, manage resources, and visualise lab layouts — all secured with role-based access control.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => navigate('/login')}
            className="group flex items-center gap-2 px-8 py-3.5 bg-brand-600 hover:bg-brand-500 text-white
                       font-semibold rounded-2xl transition-all shadow-xl shadow-brand-600/30 hover:shadow-brand-500/40
                       hover:-translate-y-0.5"
          >
            Start Managing Labs
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => onNav('features')}
            className="flex items-center gap-2 px-8 py-3.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200
                       font-semibold rounded-2xl transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            Explore Features
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {[
            { value: '∞', label: 'Labs Supported' },
            { value: '6+', label: 'Core Modules' },
            { value: '5', label: 'User Roles' },
            { value: '24/7', label: 'Live Monitoring' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-400">
        <span className="text-xs">Scroll down</span>
        <div className="w-0.5 h-8 bg-gradient-to-b from-slate-400 to-transparent rounded-full animate-bounce" />
      </div>
    </section>
  );
}

// ─── Features Carousel ────────────────────────────────────────────────────────
function FeaturesCarousel() {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const timerRef = useRef<number | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCurrent((c) => (c + 1) % FEATURES.length);
    }, 5000);
  };

  useEffect(() => {
    if (autoplay) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoplay]);

  const go = (idx: number) => {
    setCurrent(idx);
    setAutoplay(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setTimeout(() => setAutoplay(true), 8000);
  };

  const prev = () => go((current - 1 + FEATURES.length) % FEATURES.length);
  const next = () => go((current + 1) % FEATURES.length);

  const f = FEATURES[current];
  const Icon = f.icon;

  return (
    <section id="features" className="bg-slate-50 dark:bg-slate-900 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 bg-brand-50 dark:bg-slate-800 border border-brand-200 dark:border-slate-700 rounded-full
                           text-brand-600 dark:text-brand-400 text-xs font-semibold mb-4">
            Platform Features
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-brand-600 to-cyan-600 bg-clip-text text-transparent">
              Run Your Labs
            </span>
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">
            Six powerful modules, one cohesive system. Each feature is built for real lab workflows.
          </p>
        </div>

        {/* Dot + tab navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {FEATURES.map((feat, i) => {
            const FIcon = feat.icon;
            return (
              <button
                key={i}
                onClick={() => go(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  i === current
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{feat.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Carousel card */}
        <div className="relative">
          <div
            key={current}
            className={`bg-gradient-to-br ${f.bg} dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden
                        shadow-xl animate-fade-in`}
          >
            <div className="grid lg:grid-cols-2 min-h-[420px]">
              {/* Content */}
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                <div className={`w-14 h-14 rounded-2xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center mb-6`}>
                  <Icon className={`w-7 h-7 ${f.color}`} />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">{f.title}</h3>
                <p className="text-slate-600 text-base leading-relaxed mb-8">{f.description}</p>
                <ul className="space-y-3">
                  {f.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual panel */}
              <div className="relative hidden lg:flex items-center justify-center p-12">
                {/* Decorative rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-72 h-72 rounded-full border border-slate-200 dark:border-slate-700" />
                  <div className="absolute w-52 h-52 rounded-full border border-slate-200 dark:border-slate-700" />
                  <div className="absolute w-32 h-32 rounded-full border border-slate-300 dark:border-slate-600" />
                </div>
                <div className={`relative w-28 h-28 rounded-3xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center
                                 shadow-lg`}>
                  <Icon className={`w-14 h-14 ${f.color}`} />
                </div>
                {/* Floating chips */}
                {f.points.slice(0, 3).map((pt, pi) => (
                  <div
                    key={pi}
                    className="absolute bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2
                               text-xs text-slate-700 dark:text-slate-200 font-medium shadow-xl"
                    style={{
                      top: `${20 + pi * 30}%`,
                      right: pi % 2 === 0 ? '4%' : 'auto',
                      left: pi % 2 !== 0 ? '4%' : 'auto',
                    }}
                  >
                    <CheckCircle className="inline w-3 h-3 text-emerald-400 mr-1.5" />
                    {pt.split(' ').slice(0, 3).join(' ')}…
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Prev / Next */}
          <button
            onClick={prev}
            className="absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-slate-800
                       border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700
                       transition-colors shadow-lg hidden sm:flex"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-slate-800
                       border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700
                       transition-colors shadow-lg hidden sm:flex"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-8">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-8 bg-brand-500' : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        {/* Counter */}
        <p className="text-center text-slate-400 text-xs mt-3">
          {current + 1} / {FEATURES.length}
        </p>
      </div>
    </section>
  );
}

// ─── Why NexusGrid ────────────────────────────────────────────────────────────
function WhyNexusGrid() {
  return (
    <section id="why" className="bg-white dark:bg-slate-900 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 rounded-full
                           text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-4">
            Why Choose NexusGrid
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4">
            The Smarter Way to Manage{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
              Academic Labs
            </span>
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg">
            Traditional spreadsheets and generic tools simply can't handle the complexity of multi-lab operations.
            NexusGrid was purpose-built for academic institutions.
          </p>
        </div>

        {/* Advantages grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-20">
          {ADVANTAGES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-500/50
                         rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg
                         hover:shadow-brand-600/10"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-4
                              group-hover:bg-brand-100 dark:group-hover:bg-brand-800/40 transition-colors">
                <Icon className="w-5 h-5 text-brand-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl
                        overflow-hidden shadow-lg">
          <div className="px-8 pt-8 pb-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">NexusGrid vs. Generic Tools</h3>
            <p className="text-slate-500 text-sm mt-1">See what sets us apart at a glance.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-8 py-4 text-slate-500 text-sm font-medium">Capability</th>
                  <th className="px-8 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-900/30 border
                                     border-brand-200 dark:border-brand-700 rounded-full text-brand-600 dark:text-brand-400 text-xs font-bold">
                      <Zap className="w-3 h-3" /> NexusGrid
                    </span>
                  </th>
                  <th className="px-8 py-4 text-center text-slate-500 text-sm font-medium">Generic Tools</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISONS.map(({ label, nexus, others }, i) => (
                  <tr key={label} className={i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-700/40' : 'bg-white dark:bg-slate-800'}>
                    <td className="px-8 py-4 text-slate-700 dark:text-slate-300 text-sm">{label}</td>
                    <td className="px-8 py-4 text-center">
                      {nexus
                        ? <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto" />
                        : <X className="w-5 h-5 text-slate-600 mx-auto" />
                      }
                    </td>
                    <td className="px-8 py-4 text-center">
                      {others
                        ? <CheckCircle className="w-5 h-5 text-slate-500 mx-auto" />
                        : <X className="w-5 h-5 text-rose-500/70 mx-auto" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Testimonial-style quote */}
        <div className="mt-12 text-center">
          <div className="inline-block max-w-2xl bg-gradient-to-br from-brand-50 to-slate-50
                          dark:from-slate-800 dark:to-slate-800
                          border border-brand-100 dark:border-slate-700 rounded-3xl px-8 py-6 shadow-sm">
            <div className="flex gap-1 justify-center mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-base italic leading-relaxed">
              "NexusGrid replaced three separate tools we were using. The live floor-plan alone saved our technicians
              hours every week — they can now see a failing machine on the map before even leaving their desk."
            </p>
            <p className="text-brand-600 text-sm font-semibold mt-4">— IT Manager, Computer Science Faculty</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────
function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to backend contact endpoint
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <section id="contact" className="bg-slate-50 dark:bg-slate-900 py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 bg-violet-50 dark:bg-slate-800 border border-violet-200 dark:border-slate-700 rounded-full
                           text-violet-600 dark:text-violet-400 text-xs font-semibold mb-4">
            Get In Touch
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4">
            We'd Love to{' '}
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              Hear From You
            </span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-lg">
            Have a question, want a demo, or ready to deploy NexusGrid at your institution? Reach out.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Left — Form */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand-600" />
              Send a Message
            </h3>

            {submitted && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30
                              rounded-xl text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Message sent! We'll get back to you within 24 hours.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Full Name *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="John Smith"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100
                               placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2
                               focus:ring-brand-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Email Address *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="john@university.edu"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100
                               placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2
                               focus:ring-brand-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Subject</label>
                <select
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm
                             text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                             transition-all appearance-none"
                >
                  <option value="">Select a topic…</option>
                  <option value="demo">Request a Demo</option>
                  <option value="pricing">Pricing / Licensing</option>
                  <option value="support">Technical Support</option>
                  <option value="feature">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Message *</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  placeholder="Tell us about your institution and how we can help…"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100
                             placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2
                             focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-600 hover:bg-brand-500
                           text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/30
                           hover:shadow-brand-500/40"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </form>
          </div>

          {/* Right — Map + info */}
          <div className="flex flex-col gap-6">
            {/* Contact info cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  icon: MapPin,
                  label: 'Address',
                  value: 'Faculty of Computing, University Campus, Block C',
                  color: 'text-rose-400',
                  bg: 'bg-rose-500/10',
                },
                {
                  icon: Mail,
                  label: 'Email',
                  value: 'support@nexusgrid.io',
                  color: 'text-brand-600',
                  bg: 'bg-brand-500/10',
                },
                {
                  icon: Phone,
                  label: 'Phone',
                  value: '+1 (555) 012-3456',
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10',
                },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                  <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{label}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{value}</p>
                </div>
              ))}
            </div>

            {/* Hours */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Support Hours</p>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p><span className="text-slate-400 w-32 inline-block">Monday – Friday</span>8:00 AM – 6:00 PM</p>
                  <p><span className="text-slate-400 w-32 inline-block">Saturday</span>9:00 AM – 1:00 PM</p>
                  <p><span className="text-slate-400 w-32 inline-block">Sunday</span>Closed</p>
                </div>
              </div>
            </div>

            {/* Embedded Map */}
            <div className="flex-1 min-h-64 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg">
              <iframe
                title="NexusGrid Location"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-0.1300%2C51.4900%2C-0.0900%2C51.5100&layer=mapnik&marker=51.5000%2C-0.1100"
                width="100%"
                height="100%"
                style={{ minHeight: '260px', border: 0 }}
                loading="lazy"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ onNav }: { onNav: (id: string) => void }) {
  const navigate = useNavigate();

  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/40">
                <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold text-white">NexusGrid</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Purpose-built lab management for universities and research institutions. One platform, infinite possibilities.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Github, href: '#' },
                { icon: Twitter, href: '#' },
                { icon: Linkedin, href: '#' },
              ].map(({ icon: Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg
                             flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Platform</h4>
            <ul className="space-y-3">
              {[
                { label: 'Real-Time Monitoring', id: 'features' },
                { label: 'Fault Tracking', id: 'features' },
                { label: 'Resource Management', id: 'features' },
                { label: 'Lab Layout', id: 'features' },
                { label: 'Analytics', id: 'features' },
              ].map(({ label, id }) => (
                <li key={label}>
                  <button
                    onClick={() => onNav(id)}
                    className="text-sm text-slate-500 hover:text-white transition-colors"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-3">
              {[
                { label: 'Why NexusGrid', action: () => onNav('why') },
                { label: 'Contact Us', action: () => onNav('contact') },
                { label: 'Sign In', action: () => navigate('/login') },
              ].map(({ label, action }) => (
                <li key={label}>
                  <button onClick={action} className="text-sm text-slate-500 hover:text-white transition-colors">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Stay Updated</h4>
            <p className="text-sm text-slate-500 mb-4">Get release notes and lab management tips in your inbox.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 min-w-0 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white
                           placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button className="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl
                                 text-sm font-medium transition-colors shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} NexusGrid. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((t) => (
              <a key={t} href="#" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                {t}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-500">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Landing Page (Root) ──────────────────────────────────────────────────────
export default function LandingPage() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar onNav={scrollTo} />
      <Hero onNav={scrollTo} />
      <FeaturesCarousel />
      <WhyNexusGrid />
      <Contact />
      <Footer onNav={scrollTo} />
    </div>
  );
}
