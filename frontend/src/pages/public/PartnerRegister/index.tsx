import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Upload,
  CheckCircle2,
  FileText,
  Trash2,
  ShieldCheck,
  Building,
  CreditCard,
  Briefcase,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { classifyApiError } from '@/lib/apiError';
import { ROUTES } from '@/constants/routes';
import PasswordField from '@/components/auth/PasswordField';
import PasswordStrength from '@/components/auth/PasswordStrength';
import AuthFormHeader from '@/components/auth/AuthFormHeader';
import { fetchCategories } from '@/services/catalogApi';
import type { CatalogCategory } from '@/types/catalog';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[\w.-]+@[\w.-]+$/;

const ID_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'passport', label: 'Passport' },
] as const;

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
];

const DEFAULT_CATEGORIES = [
  { id: 'cat-cleaning', name: 'Cleaning & Pest Control', slug: 'cleaning' },
  { id: 'cat-appliances', name: 'Appliance Repair', slug: 'appliances' },
  { id: 'cat-plumbing', name: 'Plumbing & Electrical', slug: 'plumbing' },
  { id: 'cat-painting', name: 'Painting & Renovation', slug: 'painting' },
  { id: 'cat-sanitization', name: 'Home Sanitization', slug: 'sanitization' },
];

const CATEGORY_SKILLS_MAP: Record<string, string[]> = {
  'cleaning': [
    'Deep Home Cleaning',
    'Kitchen Cleaning',
    'Bathroom Sanitization',
    'Sofa & Carpet Cleaning',
    'Pest Control',
  ],
  'appliances': [
    'AC Servicing & Repair',
    'Refrigerator Repair',
    'Washing Machine Repair',
    'Microwave & Oven Repair',
    'Water Purifier (RO) Repair',
  ],
  'plumbing': [
    'Pipe & Drain Repair',
    'Tap & Shower Fitting',
    'Switchboard & Wiring',
    'Ceiling Fan & Lights',
    'Water Motor Installation',
  ],
  'painting': [
    'Full Home Painting',
    'Wall Water Proofing',
    'Texture & Stencil Design',
    'Carpentry & Furniture Repair',
  ],
  'sanitization': [
    'Disinfection Spraying',
    'Deep Sanitization',
    'Water Tank Cleaning',
  ],
};

const DEFAULT_WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const PartnerRegisterPage: React.FC = () => {
  const { register, logout, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Current active step (1 to 5)
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [form, setForm] = useState({
    // Section A: Personal Information
    name: '',
    gender: '',
    dob: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    avatar: '', // base64 preview

    // Section B: Identity Proof
    idProofType: 'aadhaar',
    idProofNumber: '',
    idProofFileName: '',
    idProofFileSize: 0,
    idProofDocument: '', // simulated / base64 doc reference

    // Section C: Address Proof
    address: '',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '',
    addressProofFileName: '',
    addressProofFileSize: 0,
    addressProofDocument: '',

    // Section D: Professional Details
    category: '',
    skills: [] as string[],
    experienceYears: '3',
    serviceRadiusKm: 15,
    workingDays: DEFAULT_WORKING_DAYS,
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',

    // Section E: Bank Details
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    upiId: '',
  });

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>(DEFAULT_CATEGORIES);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const idDocInputRef = useRef<HTMLInputElement>(null);
  const addressDocInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Partner Registration | HomeCareX';
  }, []);

  // Fetch real categories if available
  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((data: CatalogCategory[]) => {
        if (active && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
          setCategories(mapped);
          setForm((prev) =>
            prev.category
              ? prev
              : {
                  ...prev,
                  category: mapped[0].slug,
                  skills: CATEGORY_SKILLS_MAP[mapped[0].slug]?.slice(0, 2) || [],
                },
          );
        }
      })
      .catch(() => {
        // Fallback to default categories
        setForm((prev) =>
          prev.category
            ? prev
            : {
                ...prev,
                category: DEFAULT_CATEGORIES[0].slug,
                skills: CATEGORY_SKILLS_MAP[DEFAULT_CATEGORIES[0].slug]?.slice(0, 2) || [],
              },
        );
      });
    return () => {
      active = false;
    };
  }, []);

  // Auto-redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && user && !loading) {
      navigate(user.home || (user.role === 'admin' ? '/admin' : `/${user.role}`), { replace: true });
    }
  }, [isAuthenticated, user, loading, navigate]);

  // If already authenticated
  if (isAuthenticated && user && !loading) {
    return (
      <div className="w-full text-center">
        <AuthFormHeader
          title="Account already active"
          subtitle={
            <>
              You are already signed in as <b className="text-gray-900">{user.name}</b> ({user.role}).
            </>
          }
        />
        <div className="mt-6">
          <Link
            to={user.home || (user.role === 'admin' ? '/admin' : `/${user.role}`)}
            className="w-full text-center block rounded-lg bg-[#ff8a3d] hover:bg-[#e0600f] text-white font-medium py-2.5 shadow-sm transition"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  function normalizePhone(raw: string): string {
    const cleaned = raw.replace(/[\s()-]/g, '');
    if (cleaned.startsWith('+91')) return cleaned.slice(3);
    if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
    return cleaned;
  }

  function handleChange(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  // Profile photo handling
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFieldErrors((prev) => ({ ...prev, avatar: 'Please select a valid image (JPEG, PNG or WebP).' }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, avatar: 'Profile photo size must be under 2MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarPreview(dataUrl);
      handleChange('avatar', dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatarPreview('');
    handleChange('avatar', '');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }

  // Document upload handling
  function handleDocUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'idProof' | 'addressProof'
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        [type]: 'Only PDF, JPG, and PNG files are accepted.',
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        [type]: 'Document size must be under 5MB.',
      }));
      return;
    }

    // Clear any previous error
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[type];
      return copy;
    });

    if (type === 'idProof') {
      setForm((prev) => ({
        ...prev,
        idProofFileName: file.name,
        idProofFileSize: file.size,
        idProofDocument: `doc_id_${Date.now()}_${file.name}`,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        addressProofFileName: file.name,
        addressProofFileSize: file.size,
        addressProofDocument: `doc_addr_${Date.now()}_${file.name}`,
      }));
    }
  }

  function removeDoc(type: 'idProof' | 'addressProof') {
    if (type === 'idProof') {
      setForm((prev) => ({
        ...prev,
        idProofFileName: '',
        idProofFileSize: 0,
        idProofDocument: '',
      }));
      if (idDocInputRef.current) idDocInputRef.current.value = '';
    } else {
      setForm((prev) => ({
        ...prev,
        addressProofFileName: '',
        addressProofFileSize: 0,
        addressProofDocument: '',
      }));
      if (addressDocInputRef.current) addressDocInputRef.current.value = '';
    }
  }

  // Skills toggle
  function toggleSkill(skill: string) {
    setForm((prev) => {
      const exists = prev.skills.includes(skill);
      const nextSkills = exists ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill];
      return { ...prev, skills: nextSkills };
    });
    if (fieldErrors.skills) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy.skills;
        return copy;
      });
    }
  }

  // Working day toggle
  function toggleDay(day: string) {
    setForm((prev) => {
      const exists = prev.workingDays.includes(day);
      const nextDays = exists
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: nextDays };
    });
    if (fieldErrors.workingDays) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy.workingDays;
        return copy;
      });
    }
  }

  // Per-step validation
  function validateStep(step: number): boolean {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!form.name.trim()) {
        errors.name = 'Full name is required.';
      } else if (form.name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters.';
      }

      if (!form.gender) {
        errors.gender = 'Please select your gender.';
      } else if (!['male', 'female', 'other'].includes(form.gender)) {
        errors.gender = 'Please select a valid gender.';
      }

      if (!form.dob) {
        errors.dob = 'Date of birth is required.';
      } else {
        const selectedDate = new Date(form.dob);
        const today = new Date();
        if (selectedDate >= today) {
          errors.dob = 'Date of birth cannot be in the future.';
        } else {
          const ageDifMs = today.getTime() - selectedDate.getTime();
          const ageDate = new Date(ageDifMs);
          const age = Math.abs(ageDate.getUTCFullYear() - 1970);
          if (age < 18) {
            errors.dob = 'Partner must be at least 18 years old.';
          }
        }
      }

      const cleanedPhone = normalizePhone(form.phone);
      if (!form.phone.trim()) {
        errors.phone = 'Mobile number is required.';
      } else if (!PHONE_RE.test(cleanedPhone)) {
        errors.phone = 'Please enter a valid 10-digit Indian mobile number.';
      }

      if (!form.email.trim()) {
        errors.email = 'Email address is required.';
      } else if (!EMAIL_RE.test(form.email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }

      if (!form.password) {
        errors.password = 'Password is required.';
      } else if (form.password.length < 8) {
        errors.password = 'Password must be at least 8 characters.';
      } else if (!/[A-Z]/.test(form.password)) {
        errors.password = 'Password requires at least one uppercase letter.';
      } else if (!/[0-9]/.test(form.password)) {
        errors.password = 'Password requires at least one number.';
      } else if (!/[^A-Za-z0-9]/.test(form.password)) {
        errors.password = 'Password requires at least one special character.';
      }

      if (!form.confirmPassword) {
        errors.confirmPassword = 'Confirm your password.';
      } else if (form.password !== form.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match.';
      }
    } else if (step === 2) {
      if (!form.idProofType) {
        errors.idProofType = 'Please select an ID proof type.';
      }

      if (!form.idProofNumber.trim()) {
        errors.idProofNumber = 'ID proof number is required.';
      } else {
        const num = form.idProofNumber.trim().toUpperCase();
        if (form.idProofType === 'aadhaar' && !/^\d{12}$/.test(num.replace(/\s/g, ''))) {
          errors.idProofNumber = 'Aadhaar must be a 12-digit number.';
        } else if (form.idProofType === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(num)) {
          errors.idProofNumber = 'PAN must follow standard format (e.g. ABCDE1234F).';
        }
      }

      if (!form.idProofDocument) {
        errors.idProof = 'Please upload a photo or PDF of your ID proof.';
      }
    } else if (step === 3) {
      if (!form.address.trim()) {
        errors.address = 'Street address is required.';
      } else if (form.address.trim().length < 5) {
        errors.address = 'Address must be at least 5 characters.';
      }

      if (!form.city.trim()) {
        errors.city = 'City is required.';
      }

      if (!form.state.trim()) {
        errors.state = 'State is required.';
      }

      if (!form.pincode.trim()) {
        errors.pincode = 'Pincode is required.';
      } else if (!PINCODE_RE.test(form.pincode.trim())) {
        errors.pincode = 'Please enter a valid 6-digit Indian pincode.';
      }

      if (!form.addressProofDocument) {
        errors.addressProof = 'Please upload an address proof document.';
      }
    } else if (step === 4) {
      if (!form.category) {
        errors.category = 'Please select a primary service category.';
      }

      if (form.skills.length === 0) {
        errors.skills = 'Please select at least one skill or sub-service.';
      }

      const exp = Number(form.experienceYears);
      if (isNaN(exp) || exp < 0) {
        errors.experienceYears = 'Years of experience must be 0 or more.';
      }

      const radius = Number(form.serviceRadiusKm);
      if (isNaN(radius) || radius < 1 || radius > 100) {
        errors.serviceRadiusKm = 'Service radius must be between 1 and 100 km.';
      }

      if (form.workingDays.length === 0) {
        errors.workingDays = 'Please select at least one working day.';
      }

      if (form.workingHoursStart >= form.workingHoursEnd) {
        errors.workingHours = 'Working end time must be later than start time.';
      }
    } else if (step === 5) {
      if (!form.accountHolder.trim()) {
        errors.accountHolder = 'Account holder name is required.';
      }

      if (!form.accountNumber.trim()) {
        errors.accountNumber = 'Bank account number is required.';
      } else if (!/^\d{9,18}$/.test(form.accountNumber.trim())) {
        errors.accountNumber = 'Account number must be 9 to 18 digits.';
      }

      if (!form.ifsc.trim()) {
        errors.ifsc = 'IFSC code is required.';
      } else if (!IFSC_RE.test(form.ifsc.trim().toUpperCase())) {
        errors.ifsc = 'Please enter a valid Indian IFSC code (e.g. SBIN0001234).';
      }

      if (form.upiId.trim() && !UPI_RE.test(form.upiId.trim())) {
        errors.upiId = 'Please enter a valid UPI ID (e.g. name@okhdfcbank).';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleContinue(e: React.MouseEvent) {
    e.preventDefault();
    setError('');
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleBack(e: React.MouseEvent) {
    e.preventDefault();
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setErrorStatus(null);

    if (!termsAccepted) {
      setError('Please accept the Partner Terms & Conditions and Privacy Policy.');
      return;
    }

    if (!validateStep(5)) {
      return;
    }

    setLoading(true);
    try {
      const cleanedPhone = normalizePhone(form.phone);

      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: cleanedPhone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: 'partner',
        avatar: form.avatar || undefined,
        gender: form.gender,
        dob: form.dob,
        idProofType: form.idProofType,
        idProofNumber: form.idProofNumber.trim().toUpperCase(),
        idProofDocument: form.idProofDocument,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        addressProofDocument: form.addressProofDocument,
        category: form.category,
        skills: form.skills,
        experienceYears: Number(form.experienceYears) || 0,
        serviceRadiusKm: Number(form.serviceRadiusKm) || 15,
        workingDays: form.workingDays,
        workingHoursStart: form.workingHoursStart,
        workingHoursEnd: form.workingHoursEnd,
        accountHolder: form.accountHolder.trim(),
        accountNumber: form.accountNumber.trim(),
        ifsc: form.ifsc.trim().toUpperCase(),
        upiId: form.upiId.trim() || undefined,
      });

      // Clear the local session created by register so partner must wait for verification
      try {
        await logout();
      } catch {
        // Ignore logout error
      }

      // Redirect to login page so partner can log in with their credentials
      navigate('/login?registered=partner', {
        replace: true,
        state: {
          registeredEmail: form.email.trim().toLowerCase(),
          registeredMessage:
            'Registration successful! You can now log in with your credentials.',
        },
      });
    } catch (err) {
      const classified = classifyApiError(err);
      setErrorStatus(classified.status ?? null);

      if (classified.kind === 'offline') {
        setError('Unable to connect to the server. Please check your internet connection.');
      } else if (classified.kind === 'network') {
        setError('Unable to connect to the server. Please check your connection and try again.');
      } else if (classified.kind === 'timeout') {
        setError('The server is taking too long to respond. Please check your connection and try again.');
      } else if (classified.status === 409) {
        setError('An account with this email or mobile number already exists. Please sign in instead.');
      } else if (classified.status === 429) {
        setError('Too many registration attempts. Please wait a moment and try again.');
      } else if (classified.status && classified.status >= 500) {
        setError('A server error occurred. Please try again shortly.');
      } else {
        setError(classified.message || 'Partner registration failed. Please review your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Available skills for current category
  const availableSkills = CATEGORY_SKILLS_MAP[form.category] || [
    'General Service',
    'Maintenance',
    'Deep Inspection',
    'Emergency Repair',
  ];

  return (
    <div className="w-full">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-2 mb-4 pb-2.5 border-b border-gray-200/70 shrink-0">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-600 hover:text-[#4338ca] hover:-translate-x-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-[#4338ca] rounded py-1 shrink-0 whitespace-nowrap"
          aria-label="Back to Home"
        >
          <ArrowLeft size={16} className="shrink-0" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
        <span className="text-[11px] sm:text-xs font-semibold text-[#4338ca] bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
          Partner Registration
        </span>
      </div>

      <AuthFormHeader
        title={
          <>
            Become a <span className="text-[#4338ca]">HomeCare<span className="text-[#ff8a3d]">X</span></span> Partner
          </>
        }
        subtitle="Grow your business with verified bookings and prompt payouts"
      />

      {/* Stepper progress indicator */}
      <nav aria-label="Registration Progress" className="mb-6">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {[
            { step: 1, label: 'Personal' },
            { step: 2, label: 'Identity' },
            { step: 3, label: 'Address' },
            { step: 4, label: 'Skills' },
            { step: 5, label: 'Payout' },
          ].map(({ step, label }) => {
            const isActive = currentStep === step;
            const isDone = currentStep > step;
            return (
              <button
                type="button"
                key={step}
                onClick={() => {
                  if (step < currentStep) setCurrentStep(step);
                }}
                disabled={step > currentStep}
                aria-current={isActive ? 'step' : undefined}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 sm:px-2.5 rounded-xl text-xs font-semibold transition-all border ${
                  isActive
                    ? 'bg-[#4338ca] border-[#4338ca] text-white shadow-sm ring-2 ring-indigo-200'
                    : isDone
                    ? 'bg-indigo-50/80 border-indigo-200 text-[#4338ca] hover:bg-indigo-100 cursor-pointer'
                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-white text-[#4338ca]'
                      : isDone
                      ? 'bg-[#4338ca] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isDone ? '✓' : step}
                </span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#4338ca] to-[#ff8a3d] h-1.5 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </nav>

      {/* Server error alert */}
      {error && (
        <div
          role="alert"
          id="partner-register-error"
          className={`mb-3 text-xs rounded-lg p-2.5 flex items-start gap-2 animate-fadeUp ${
            errorStatus === 409 || errorStatus === 429
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {errorStatus === 409 || errorStatus === 429 ? (
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
          ) : (
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
          )}
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {/* ======================================================== */}
        {/* STEP 1: SECTION A - PERSONAL INFORMATION                 */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <section aria-labelledby="step-1-title" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h2 id="step-1-title" className="text-sm font-bold text-slate-900 tracking-tight">
                  Section A: Personal Information
                </h2>
                <p className="text-xs text-slate-500">Your profile details as they will appear to customers</p>
              </div>
              <span className="text-xs font-semibold text-[#4338ca] bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 rounded-full shrink-0">
                Step 1 of 5
              </span>
            </div>

            {/* Profile Photo Preview / Replace / Remove */}
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl shadow-xs">
              <div className="relative shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile preview"
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#4338ca] shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 border border-slate-300">
                    <User size={24} aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-slate-900">
                  Profile Photo <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </span>
                <p className="text-[11px] text-slate-500 mb-2">
                  Clear photo showing your face (JPG/PNG, max 2MB)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    id="partner-avatar-input"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    className="sr-only"
                    aria-label="Upload profile photo"
                  />
                  <label
                    htmlFor="partner-avatar-input"
                    className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-300 hover:border-[#4338ca] text-slate-700 hover:text-[#4338ca] px-3 py-1.5 rounded-lg shadow-xs transition-colors focus-within:ring-2 focus-within:ring-[#4338ca]"
                  >
                    <Upload size={13} />
                    {avatarPreview ? 'Replace' : 'Upload Photo'}
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      aria-label="Remove profile photo"
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  )}
                </div>
                {fieldErrors.avatar && (
                  <p role="alert" className="mt-1 text-[11px] text-red-600">
                    {fieldErrors.avatar}
                  </p>
                )}
              </div>
            </div>

            {/* Full Name */}
            <div className="group">
              <label htmlFor="partner-name" className="block text-xs font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                  <User size={15} aria-hidden="true" />
                </div>
                <input
                  id="partner-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                  className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                    fieldErrors.name ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-300'
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <p id="name-error" role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Date of Birth & Gender in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* DOB */}
              <div className="group">
                <label htmlFor="partner-dob" className="block text-xs font-medium text-gray-700 mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                    <Calendar size={15} aria-hidden="true" />
                  </div>
                  <input
                    id="partner-dob"
                    type="date"
                    name="dob"
                    max={new Date().toISOString().split('T')[0]}
                    value={form.dob}
                    onChange={(e) => handleChange('dob', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.dob)}
                    aria-describedby={fieldErrors.dob ? 'dob-error' : undefined}
                    className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                      fieldErrors.dob ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                </div>
                {fieldErrors.dob && (
                  <p id="dob-error" role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.dob}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div className="group">
                <label htmlFor="partner-gender" className="block text-xs font-medium text-gray-700 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  id="partner-gender"
                  name="gender"
                  value={form.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.gender)}
                  aria-describedby={fieldErrors.gender ? 'gender-error' : undefined}
                  className={`w-full rounded-lg border bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                    fieldErrors.gender ? 'border-red-400 focus:ring-red-400/30' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {fieldErrors.gender && (
                  <p id="gender-error" role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.gender}
                  </p>
                )}
              </div>
            </div>

            {/* Mobile Number & Email Address in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Mobile Number */}
              <div className="group">
                <label htmlFor="partner-phone" className="block text-xs font-medium text-gray-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                    <Phone size={15} aria-hidden="true" />
                  </div>
                  <input
                    id="partner-phone"
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="9876543210"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                    className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                      fieldErrors.phone ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p id="phone-error" role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div className="group">
                <label htmlFor="partner-email" className="block text-xs font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                    <Mail size={15} aria-hidden="true" />
                  </div>
                  <input
                    id="partner-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="ramesh.partner@example.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                      fieldErrors.email ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="email-error" role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <PasswordField
                  id="partner-password"
                  name="password"
                  label="Create Password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  error={fieldErrors.password}
                  className="!py-1.5 sm:!py-2 text-xs sm:text-sm"
                />
                <PasswordStrength password={form.password} />
              </div>
              <div>
                <PasswordField
                  id="partner-confirm-password"
                  name="confirmPassword"
                  label="Confirm Password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  error={fieldErrors.confirmPassword}
                  className="!py-1.5 sm:!py-2 text-xs sm:text-sm"
                />
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* STEP 2: SECTION B - IDENTITY PROOF                       */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <section aria-labelledby="step-2-title" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h2 id="step-2-title" className="text-sm font-bold text-slate-900 tracking-tight">
                  Section B: Identity Proof
                </h2>
                <p className="text-xs text-slate-500">Government identity for background verification and customer trust</p>
              </div>
              <span className="text-xs font-semibold text-[#4338ca] bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 rounded-full shrink-0">
                Step 2 of 5
              </span>
            </div>

            {/* ID Proof Type */}
            <div>
              <label htmlFor="partner-id-type" className="block text-xs font-medium text-gray-700 mb-1">
                ID Proof Type <span className="text-red-500">*</span>
              </label>
              <select
                id="partner-id-type"
                name="idProofType"
                value={form.idProofType}
                onChange={(e) => handleChange('idProofType', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca]"
              >
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* ID Proof Number */}
            <div className="group">
              <label htmlFor="partner-id-number" className="block text-xs font-medium text-gray-700 mb-1">
                ID Proof Number <span className="text-red-500">*</span>
              </label>
              <input
                id="partner-id-number"
                type="text"
                name="idProofNumber"
                value={form.idProofNumber}
                onChange={(e) => handleChange('idProofNumber', e.target.value.toUpperCase())}
                placeholder={
                  form.idProofType === 'aadhaar'
                    ? '12-digit Aadhaar number'
                    : form.idProofType === 'pan'
                    ? '10-character PAN (e.g. ABCDE1234F)'
                    : 'Enter document number'
                }
                aria-invalid={Boolean(fieldErrors.idProofNumber)}
                aria-describedby={fieldErrors.idProofNumber ? 'id-number-error' : undefined}
                className={`w-full rounded-lg border bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                  fieldErrors.idProofNumber ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {fieldErrors.idProofNumber && (
                <p id="id-number-error" role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.idProofNumber}
                </p>
              )}
            </div>

            {/* ID Proof Document Upload */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Upload ID Proof Document <span className="text-red-500">*</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
                  fieldErrors.idProof ? 'border-red-300 bg-red-50/50' : 'border-gray-300 bg-gray-50/60 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={idDocInputRef}
                  type="file"
                  id="partner-id-doc-input"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => handleDocUpload(e, 'idProof')}
                  className="sr-only"
                  aria-label="Upload ID Proof Document"
                />

                {form.idProofFileName ? (
                  <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={18} className="text-[#4338ca] shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-medium text-gray-900 truncate">{form.idProofFileName}</p>
                        <p className="text-[10px] text-gray-500">
                          {(form.idProofFileSize / 1024).toFixed(1)} KB • Attached
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label
                        htmlFor="partner-id-doc-input"
                        className="cursor-pointer text-[11px] text-[#4338ca] hover:underline px-1.5 py-0.5"
                      >
                        Replace
                      </label>
                      <button
                        type="button"
                        onClick={() => removeDoc('idProof')}
                        aria-label="Remove ID document"
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload size={22} className="mx-auto text-gray-400 mb-1" />
                    <label
                      htmlFor="partner-id-doc-input"
                      className="cursor-pointer text-xs font-semibold text-[#4338ca] hover:underline"
                    >
                      Click to choose document
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">PDF, JPG, or PNG (Max 5MB)</p>
                  </div>
                )}
              </div>
              {fieldErrors.idProof && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.idProof}
                </p>
              )}
            </div>

            <div className="p-2 bg-indigo-50/60 border border-indigo-100 rounded text-[11px] text-indigo-900 flex items-start gap-1.5">
              <ShieldCheck size={14} className="text-[#4338ca] shrink-0 mt-0.5" />
              <span>Identity proof documents are stored securely and reviewed by our compliance team during onboarding.</span>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SECTION C - ADDRESS PROOF                        */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <section aria-labelledby="step-3-title" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h2 id="step-3-title" className="text-sm font-bold text-slate-900 tracking-tight">
                  Section C: Address Proof
                </h2>
                <p className="text-xs text-slate-500">Your base location where nearby customers will discover your services</p>
              </div>
              <span className="text-xs font-semibold text-[#4338ca] bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 rounded-full shrink-0">
                Step 3 of 5
              </span>
            </div>

            {/* Street Address */}
            <div className="group">
              <label htmlFor="partner-address" className="block text-xs font-medium text-gray-700 mb-1">
                Street Address / Locality <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-2.5 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                  <MapPin size={15} aria-hidden="true" />
                </div>
                <textarea
                  id="partner-address"
                  rows={2}
                  name="address"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Flat / Door No, Street, Landmark"
                  aria-invalid={Boolean(fieldErrors.address)}
                  aria-describedby={fieldErrors.address ? 'address-error' : undefined}
                  className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                    fieldErrors.address ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
              </div>
              {fieldErrors.address && (
                <p id="address-error" role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.address}
                </p>
              )}
            </div>

            {/* City & State in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* City */}
              <div className="group">
                <label htmlFor="partner-city" className="block text-xs font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  id="partner-city"
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="e.g. Hyderabad"
                  aria-invalid={Boolean(fieldErrors.city)}
                  className={`w-full rounded-lg border bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                    fieldErrors.city ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.city && (
                  <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.city}
                  </p>
                )}
              </div>

              {/* State */}
              <div>
                <label htmlFor="partner-state" className="block text-xs font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  id="partner-state"
                  name="state"
                  value={form.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca]"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {fieldErrors.state && (
                  <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.state}
                  </p>
                )}
              </div>
            </div>

            {/* Pincode */}
            <div className="group">
              <label htmlFor="partner-pincode" className="block text-xs font-medium text-gray-700 mb-1">
                Pincode <span className="text-red-500">*</span>
              </label>
              <input
                id="partner-pincode"
                type="text"
                name="pincode"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => handleChange('pincode', e.target.value.replace(/\D/g, ''))}
                placeholder="500001"
                aria-invalid={Boolean(fieldErrors.pincode)}
                className={`w-full rounded-lg border bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                  fieldErrors.pincode ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {fieldErrors.pincode && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.pincode}
                </p>
              )}
            </div>

            {/* Address Proof Upload */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Upload Address Proof Document <span className="text-red-500">*</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
                  fieldErrors.addressProof ? 'border-red-300 bg-red-50/50' : 'border-gray-300 bg-gray-50/60 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={addressDocInputRef}
                  type="file"
                  id="partner-addr-doc-input"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => handleDocUpload(e, 'addressProof')}
                  className="sr-only"
                  aria-label="Upload Address Proof Document"
                />

                {form.addressProofFileName ? (
                  <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={18} className="text-[#4338ca] shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-medium text-gray-900 truncate">{form.addressProofFileName}</p>
                        <p className="text-[10px] text-gray-500">
                          {(form.addressProofFileSize / 1024).toFixed(1)} KB • Attached
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label
                        htmlFor="partner-addr-doc-input"
                        className="cursor-pointer text-[11px] text-[#4338ca] hover:underline px-1.5 py-0.5"
                      >
                        Replace
                      </label>
                      <button
                        type="button"
                        onClick={() => removeDoc('addressProof')}
                        aria-label="Remove address document"
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload size={22} className="mx-auto text-gray-400 mb-1" />
                    <label
                      htmlFor="partner-addr-doc-input"
                      className="cursor-pointer text-xs font-semibold text-[#4338ca] hover:underline"
                    >
                      Choose electricity bill, rental agreement, or gas bill
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">PDF, JPG, or PNG (Max 5MB)</p>
                  </div>
                )}
              </div>
              {fieldErrors.addressProof && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.addressProof}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* STEP 4: SECTION D - PROFESSIONAL DETAILS                 */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <section aria-labelledby="step-4-title" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h2 id="step-4-title" className="text-sm font-bold text-slate-900 tracking-tight">
                  Section D: Professional Details
                </h2>
                <p className="text-xs text-slate-500">Select your core services, skills, and weekly availability</p>
              </div>
              <span className="text-xs font-semibold text-[#4338ca] bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 rounded-full shrink-0">
                Step 4 of 5
              </span>
            </div>

            {/* Service Category */}
            <div>
              <label htmlFor="partner-category" className="block text-xs font-medium text-gray-700 mb-1">
                Primary Service Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="partner-category"
                  name="category"
                  value={form.category}
                  onChange={(e) => {
                    const catSlug = e.target.value;
                    handleChange('category', catSlug);
                    // auto pick default skills
                    const newSkills = CATEGORY_SKILLS_MAP[catSlug]?.slice(0, 2) || [];
                    handleChange('skills', newSkills);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca]"
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {fieldErrors.category && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.category}
                </p>
              )}
            </div>

            {/* Sub-Services / Skills Badges */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Select Your Skills / Services <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                {availableSkills.map((skill) => {
                  const isSelected = form.skills.includes(skill);
                  return (
                    <button
                      type="button"
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                        isSelected
                          ? 'bg-[#4338ca] text-white shadow-xs'
                          : 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {skill}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.skills && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.skills}
                </p>
              )}
            </div>

            {/* Experience & Service Radius in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Experience Years */}
              <div className="group">
                <label htmlFor="partner-exp" className="block text-xs font-medium text-gray-700 mb-1">
                  Years of Experience <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Briefcase size={15} />
                  </div>
                  <input
                    id="partner-exp"
                    type="number"
                    min="0"
                    max="50"
                    name="experienceYears"
                    value={form.experienceYears}
                    onChange={(e) => handleChange('experienceYears', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca]"
                  />
                </div>
                {fieldErrors.experienceYears && (
                  <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.experienceYears}
                  </p>
                )}
              </div>

              {/* Service Radius */}
              <div className="group">
                <label htmlFor="partner-radius" className="block text-xs font-medium text-gray-700 mb-1">
                  Service Radius <span className="text-[#4338ca] font-semibold">({form.serviceRadiusKm} km)</span>
                </label>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="partner-radius"
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    name="serviceRadiusKm"
                    value={form.serviceRadiusKm}
                    onChange={(e) => handleChange('serviceRadiusKm', Number(e.target.value))}
                    className="w-full accent-[#4338ca] cursor-pointer"
                  />
                  <span className="text-xs font-medium text-gray-600 shrink-0 w-12 text-right">
                    {form.serviceRadiusKm} km
                  </span>
                </div>
                {fieldErrors.serviceRadiusKm && (
                  <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.serviceRadiusKm}
                  </p>
                )}
              </div>
            </div>

            {/* Working Days */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Working Days <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1">
                {ALL_DAYS.map((day) => {
                  const isChecked = form.workingDays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                        isChecked
                          ? 'bg-[#ff8a3d] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.workingDays && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.workingDays}
                </p>
              )}
            </div>

            {/* Working Hours Start & End */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="partner-start-time" className="block text-xs font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  id="partner-start-time"
                  type="time"
                  name="workingHoursStart"
                  value={form.workingHoursStart}
                  onChange={(e) => handleChange('workingHoursStart', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30"
                />
              </div>
              <div>
                <label htmlFor="partner-end-time" className="block text-xs font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  id="partner-end-time"
                  type="time"
                  name="workingHoursEnd"
                  value={form.workingHoursEnd}
                  onChange={(e) => handleChange('workingHoursEnd', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30"
                />
              </div>
            </div>
            {fieldErrors.workingHours && (
              <p role="alert" className="text-[11px] text-red-600">
                {fieldErrors.workingHours}
              </p>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* STEP 5: SECTION E - BANK DETAILS & REVIEW                */}
        {/* ======================================================== */}
        {currentStep === 5 && (
          <section aria-labelledby="step-5-title" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h2 id="step-5-title" className="text-sm font-bold text-slate-900 tracking-tight">
                  Section E: Bank & Payout Details
                </h2>
                <p className="text-xs text-slate-500">Secure bank account or UPI ID for weekly earnings deposit</p>
              </div>
              <span className="text-xs font-semibold text-[#4338ca] bg-indigo-50 border border-indigo-200/70 px-2.5 py-0.5 rounded-full shrink-0">
                Step 5 of 5
              </span>
            </div>

            {/* Direct Activation status badge */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
              <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-900">Direct Activation:</span>
                  <span className="text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
                    Instant Access
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-snug">
                  Your account is activated immediately upon submission so you can sign in directly with your credentials.
                </p>
              </div>
            </div>

            {/* Account Holder Name */}
            <div className="group">
              <label htmlFor="partner-holder-name" className="block text-xs font-medium text-gray-700 mb-1">
                Account Holder Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                  <User size={15} />
                </div>
                <input
                  id="partner-holder-name"
                  type="text"
                  name="accountHolder"
                  value={form.accountHolder}
                  onChange={(e) => handleChange('accountHolder', e.target.value)}
                  placeholder="As written in passbook or cheque"
                  aria-invalid={Boolean(fieldErrors.accountHolder)}
                  className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                    fieldErrors.accountHolder ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
              </div>
              {fieldErrors.accountHolder && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.accountHolder}
                </p>
              )}
            </div>

            {/* Bank Account Number with concealment toggle */}
            <div className="group">
              <label htmlFor="partner-account-number" className="block text-xs font-medium text-gray-700 mb-1">
                Bank Account Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                  <CreditCard size={15} />
                </div>
                <input
                  id="partner-account-number"
                  type={showAccountNumber ? 'text' : 'password'}
                  name="accountNumber"
                  value={form.accountNumber}
                  onChange={(e) => handleChange('accountNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="9 to 18 digits"
                  aria-invalid={Boolean(fieldErrors.accountNumber)}
                  className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-9 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                    fieldErrors.accountNumber ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowAccountNumber((prev) => !prev)}
                  aria-label={showAccountNumber ? 'Hide account number' : 'Show account number'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showAccountNumber ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {fieldErrors.accountNumber && (
                <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                  {fieldErrors.accountNumber}
                </p>
              )}
            </div>

            {/* IFSC & UPI ID in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* IFSC */}
              <div className="group">
                <label htmlFor="partner-ifsc" className="block text-xs font-medium text-gray-700 mb-1">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#4338ca] pointer-events-none">
                    <Building size={15} />
                  </div>
                  <input
                    id="partner-ifsc"
                    type="text"
                    name="ifsc"
                    maxLength={11}
                    value={form.ifsc}
                    onChange={(e) => handleChange('ifsc', e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    aria-invalid={Boolean(fieldErrors.ifsc)}
                    className={`w-full rounded-lg border bg-white pl-8 sm:pl-9 pr-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                      fieldErrors.ifsc ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                </div>
                {fieldErrors.ifsc && (
                  <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.ifsc}
                  </p>
                )}
              </div>

              {/* UPI ID (Optional) */}
              <div className="group">
                <label htmlFor="partner-upi" className="block text-xs font-medium text-gray-700 mb-1">
                  UPI ID <span className="text-gray-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  id="partner-upi"
                  type="text"
                  name="upiId"
                  value={form.upiId}
                  onChange={(e) => handleChange('upiId', e.target.value.toLowerCase())}
                  placeholder="name@okhdfcbank"
                  aria-invalid={Boolean(fieldErrors.upiId)}
                  className={`w-full rounded-lg border bg-white px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 focus:border-[#4338ca] ${
                    fieldErrors.upiId ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.upiId && (
                  <p role="alert" className="mt-0.5 text-[11px] text-red-600">
                    {fieldErrors.upiId}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Review Card */}
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1 text-gray-600">
              <span className="font-semibold text-gray-800 block text-[11px] uppercase tracking-wide">
                Registration Summary:
              </span>
              <p>
                • <b>Partner:</b> {form.name || '—'} ({form.phone || '—'})
              </p>
              <p>
                • <b>Location:</b> {form.city || '—'}, {form.state || '—'} ({form.pincode || '—'})
              </p>
              <p>
                • <b>Services:</b> {form.skills.join(', ') || 'No skills selected'}
              </p>
              <p>
                • <b>Payout to:</b> {form.accountHolder || '—'} (A/C ending in{' '}
                {form.accountNumber ? form.accountNumber.slice(-4) : '••••'})
              </p>
            </div>

            {/* Terms Consent */}
            <div className="flex items-start gap-2 pt-1">
              <input
                id="partner-terms-consent"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  if (e.target.checked && error.includes('Terms & Conditions')) {
                    setError('');
                  }
                }}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-[#4338ca] focus:ring-2 focus:ring-[#4338ca]/30 cursor-pointer"
              />
              <label
                htmlFor="partner-terms-consent"
                className="text-[11px] sm:text-xs text-gray-600 leading-snug cursor-pointer select-none"
              >
                I agree to the HomeCareX{' '}
                <Link
                  to={ROUTES.TERMS}
                  target="_blank"
                  className="text-[#4338ca] font-medium hover:underline"
                >
                  Partner Agreement
                </Link>{' '}
                and{' '}
                <Link
                  to={ROUTES.PRIVACY}
                  target="_blank"
                  className="text-[#4338ca] font-medium hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
          </section>
        )}

        {/* Stepper Actions: Back, Continue, Submit */}
        <div className="pt-2 flex items-center gap-2">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="w-1/3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleContinue}
              className={`${
                currentStep > 1 ? 'w-2/3' : 'w-full'
              } bg-[#4338ca] hover:bg-[#3730a3] text-white font-medium py-2 sm:py-2.5 rounded-lg shadow-sm transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#4338ca] text-xs sm:text-sm`}
            >
              Continue to Step {currentStep + 1}
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="w-2/3 bg-[#ff8a3d] hover:bg-[#e0600f] text-white font-medium py-2 sm:py-2.5 rounded-lg shadow-sm hover:shadow-md hover:shadow-[#ff8a3d]/25 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#ff8a3d] text-xs sm:text-sm"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Submitting profile...</span>
                </>
              ) : (
                <>
                  <span>Register as Partner</span>
                  <CheckCircle2 size={15} />
                </>
              )}
            </button>
          )}
        </div>
      </form>

      <p className="text-center text-xs text-gray-500 mt-3">
        Already registered as a partner?{' '}
        <Link to="/login" className="text-[#4338ca] font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-[#4338ca] rounded">
          Sign in here
        </Link>
      </p>
    </div>
  );
};

export default PartnerRegisterPage;