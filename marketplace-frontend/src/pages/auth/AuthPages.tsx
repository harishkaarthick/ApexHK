import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

import api from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import type { TokenPair } from '@/types';
import { Field, LoadingBlock, unwrap } from '@/pages/pageShared';
import { scaleIn, staggerContainer, fadeInUp } from '@/lib/motion';

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Password needs an uppercase letter').regex(/[0-9]/, 'Password needs a number'),
  role: z.enum(['CUSTOMER', 'VENDOR']),
  storeName: z.string().optional(),
  storeDescription: z.string().optional(),
}).refine((v) => v.role !== 'VENDOR' || (v.storeName || '').length >= 2, {
  path: ['storeName'],
  message: 'Store name is required for vendors',
});

export function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'CUSTOMER' | 'VENDOR'>('CUSTOMER');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 34;
    if (/[A-Z]/.test(password)) score += 33;
    if (/[0-9]/.test(password)) score += 33;
    return score;
  }, [password]);

  const mutation = useMutation({
    mutationFn: (body: z.infer<typeof registerSchema>) => api.post('/auth/register', body),
    onSuccess: () => {
      toast.success('Registration successful. Please check your email to verify your account.');
      navigate('/login');
    },
    onError: (err: any) => {
      const status = err.response?.status;
      if (status === 409) setError('An account with this email already exists.');
      else if (status === 400) setError(err.response?.data?.message || 'Invalid input. Please check your details.');
      else if (status === 429) setError('Too many attempts. Please wait a minute and try again.');
      else setError('Registration failed. Please try again.');
    },
  });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    body.role = role;
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return setError(parsed.error.errors[0].message);
    mutation.mutate(parsed.data);
  };

  return (
    <AuthShell title="Create account" subtitle="Choose a customer account or register your store for review.">
      <motion.form onSubmit={submit} className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
        <AnimatedError message={error} tone="error" />
        <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
          {(['CUSTOMER', 'VENDOR'] as const).map((r) => (
            <motion.button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className="relative rounded-lg px-3 py-2 text-sm font-semibold"
              whileTap={{ scale: 0.94 }}
            >
              {role === r && <motion.span layoutId="authRolePill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent-indigo to-accent-purple" />}
              <span className={`relative ${role === r ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {r === 'CUSTOMER' ? 'Customer' : 'Vendor'}
              </span>
            </motion.button>
          ))}
        </motion.div>
        <motion.div variants={fadeInUp}><Field label="Name"><input name="name" className="input" /></Field></motion.div>
        <motion.div variants={fadeInUp}><Field label="Email"><input name="email" type="email" className="input" /></Field></motion.div>
        <motion.div variants={fadeInUp}>
          <Field label="Password"><input name="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-accent-indigo to-accent-purple" animate={{ width: `${strength}%` }} transition={{ duration: 0.4 }} />
          </div>
        </motion.div>
        <AnimatePresence>
          {role === 'VENDOR' && (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" exit="hidden" className="space-y-4">
              <motion.div variants={fadeInUp}><Field label="Store name"><input name="storeName" className="input" /></Field></motion.div>
              <motion.div variants={fadeInUp}><Field label="Store description"><textarea name="storeDescription" className="input min-h-24" /></Field></motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <SubmitButton loading={mutation.isPending}>Register</SubmitButton>
        <p className="text-center text-sm text-slate-600 dark:text-slate-300">
          Already have an account? <Link className="font-medium text-primary-700 dark:text-primary-300" to="/login">Sign in</Link>
        </p>
      </motion.form>
    </AuthShell>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [message, setMessage] = useState('');
  const [pendingVendor, setPendingVendor] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-fill admin credentials when arriving from the navbar Admin button
  useEffect(() => {
    if ((location.state as any)?.adminQuickFill) {
      if (emailRef.current) emailRef.current.value = 'admin@marketplace.com';
      if (passwordRef.current) passwordRef.current.value = 'Admin@123';
    }
  }, [location.state]);

  const mutation = useMutation({
    mutationFn: (body: { email: string; password: string }) => api.post('/auth/login', body).then((r) => unwrap<TokenPair>(r)),
    onSuccess: (pair) => {
      setTokens(pair);
      navigate(pair.user.role === 'VENDOR' ? '/vendor/dashboard' : pair.user.role === 'ADMIN' ? '/admin/dashboard' : '/');
    },
    onError: (err: any) => {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Login failed';
      setMessage(msg);
      setPendingVendor(status === 403 && msg.toLowerCase().includes('pending'));
    },
  });

  const fillAdmin = () => {
    if (emailRef.current) emailRef.current.value = 'admin@marketplace.com';
    if (passwordRef.current) passwordRef.current.value = 'Admin@123';
    setMessage('');
    setPendingVendor(false);
  };

  return (
    <AuthShell title="Sign in" subtitle="Use the account verified with ApexHK.">
      <motion.form
        className="space-y-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          mutation.mutate({ email: String(fd.get('email') || ''), password: String(fd.get('password') || '') });
        }}
      >
        <AnimatedError message={pendingVendor ? "Your store is under review. You'll receive an email when it's approved." : message} tone={pendingVendor ? 'warning' : 'error'} />
        <motion.div variants={fadeInUp}><Field label="Email"><input ref={emailRef} name="email" type="email" className="input" /></Field></motion.div>
        <motion.div variants={fadeInUp}><Field label="Password"><input ref={passwordRef} name="password" type="password" className="input" /></Field></motion.div>
        <SubmitButton loading={mutation.isPending}>Sign in</SubmitButton>

        {/* Admin quick-fill — dev convenience */}
        <motion.div variants={fadeInUp} className="relative flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border dark:bg-border-dark" />
          <span className="text-xs text-slate-400 dark:text-slate-500">or</span>
          <div className="h-px flex-1 bg-border dark:bg-border-dark" />
        </motion.div>
        <motion.button
          type="button"
          variants={fadeInUp}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={fillAdmin}
          className="btn-premium-secondary w-full gap-2"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-accent-indigo to-accent-purple text-[10px] font-bold text-white">A</span>
          Quick fill: Admin
        </motion.button>

        <p className="text-center text-sm text-slate-600 dark:text-slate-300">
          New here? <Link className="font-medium text-primary-700 dark:text-primary-300" to="/register">Create an account</Link>
        </p>
      </motion.form>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground dark:bg-background-dark dark:text-foreground-dark">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-center">
          <span className="font-brand text-3xl">Apex<span className="bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">HK</span></span>
        </Link>
        <motion.div className="card p-6" variants={scaleIn} initial="hidden" animate="visible">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          {children}
        </motion.div>
      </div>
    </main>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const query = useQuery({
    queryKey: ['verify-email', token],
    queryFn: () => api.get('/auth/verify-email', { params: { token } }),
    enabled: Boolean(token),
    retry: false,
  });

  return (
    <AuthShell title="Email verification" subtitle="We are checking your verification link.">
      {!token && <AnimatedError message="Missing verification token." tone="error" />}
      {token && query.isLoading && <LoadingBlock />}
      {query.isSuccess && (
        <motion.div className="text-center" variants={scaleIn} initial="hidden" animate="visible">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-medium">Email verified successfully.</p>
          <Link className="btn-premium mt-5" to="/login">Go to login</Link>
        </motion.div>
      )}
      {query.isError && <AnimatedError message={(query.error as any)?.response?.data?.message || 'This verification link is invalid or expired.'} tone="error" />}
    </AuthShell>
  );
}

function AnimatedError({ message, tone }: { message: string; tone: 'error' | 'warning' }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`overflow-hidden rounded-lg p-3 text-sm ${
            tone === 'warning'
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
              : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200'
          }`}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <motion.button type="submit" className="btn-premium w-full" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span
            key="spinner"
            className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          />
        ) : (
          <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}