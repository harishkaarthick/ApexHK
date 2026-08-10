/**
 * AdminBannersPage.tsx
 * ─────────────────────────────────────────────────────────────
 * Banner management: create form (multipart) + delete with
 * confirm dialog.
 * GET    /public/banners
 * POST   /admin/banners  (multipart/form-data)
 * DELETE /admin/banners/:id
 * ─────────────────────────────────────────────────────────────
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ImagePlus, Trash2 } from 'lucide-react';

import api from '@/lib/axios';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { Empty, Field, PortalPage, StatusBadge, unwrap } from '@/pages/pageShared';
import type { Banner } from '@/types';
import { ConfirmDialog, SkeletonList, ToggleSwitch } from './AdminPages';

// ─── Create banner form ───────────────────────────────────────

function CreateBannerForm({ onCreated }: { onCreated: () => void }) {
  const [active, setActive] = useState(true);
  const [placement, setPlacement] = useState<'HOME' | 'CATEGORY'>('HOME');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: (fd: FormData) => api.post('/admin/banners', fd),
    onSuccess: () => {
      toast.success('Banner created');
      setPreview(null);
      setActive(true);
      setPlacement('HOME');
      if (fileRef.current) fileRef.current.value = '';
      onCreated();
    },
    onError: () => toast.error('Failed to create banner'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData();
    const imageFile = (form.elements.namedItem('image') as HTMLInputElement)
      .files?.[0];
    if (!imageFile) return toast.error('Please select an image');

    fd.append('image', imageFile);
    fd.append(
      'data',
      new Blob([JSON.stringify({
        title: (form.elements.namedItem('title') as HTMLInputElement).value.trim(),
        description: (form.elements.namedItem('description') as HTMLInputElement).value.trim(),
        linkUrl: (form.elements.namedItem('link') as HTMLInputElement).value.trim() || null,
        active,
        placement,
      })], { type: 'application/json' }),
    );
    create.mutate(fd);
    form.reset();
  };

  return (
    <motion.form
      className="card mb-6 space-y-3 p-5"
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      onSubmit={handleSubmit}
    >
      <h2 className="font-semibold">New banner</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input className="input" name="title" required />
        </Field>
        <Field label="Link (optional)">
          <input className="input" name="link" type="url" />
        </Field>
      </div>

      <Field label="Placement">
        <select
          className="input"
          name="placement"
          value={placement}
          onChange={(e) => setPlacement(e.target.value as 'HOME' | 'CATEGORY')}
        >
          <option value="HOME">Homepage (top hero banner)</option>
          <option value="CATEGORY">Promotion banner</option>
        </select>
      </Field>

      <Field label="Description">
        <textarea className="input" name="description" rows={2} required />
      </Field>

      <Field label="Image">
        <div
          className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 transition-colors hover:border-primary-400 dark:border-slate-600"
          onClick={() => fileRef.current?.click()}
        >
          {preview ? (
            <img
              src={preview}
              className="max-h-36 w-full rounded-lg object-contain"
              alt="preview"
            />
          ) : (
            <>
              <ImagePlus className="mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-500">Click to select image</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <ToggleSwitch enabled={active} onChange={() => setActive((v) => !v)} />
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <button
        className="btn-premium w-full"
        disabled={create.isPending}
      >
        {create.isPending ? 'Uploading…' : 'Create banner'}
      </button>
    </motion.form>
  );
}

// ─── Page ────────────────────────────────────────────────────

export function AdminBannersPage() {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<Banner | null>(null);

  const { data, isLoading, isError } = useQuery<Banner[]>({
    queryKey: ['banners'],
    queryFn: () =>
      api.get('/public/banners').then((r) => unwrap<Banner[]>(r)),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/banners/${id}`),
    onSuccess: () => {
      toast.success('Banner deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['banners'] });
    },
    onError: () => toast.error('Failed to delete banner'),
  });

  return (
    <PortalPage title="Banners">
      <CreateBannerForm
        onCreated={() => qc.invalidateQueries({ queryKey: ['banners'] })}
      />

      {isError && (
        <p className="text-error mb-3 text-sm">Failed to load banners.</p>
      )}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : (data ?? []).length === 0 ? (
        <Empty title="No banners yet." />
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {(data ?? []).map((b) => (
            <motion.div
              key={b.id}
              className="card overflow-hidden"
              variants={fadeInUp}
              whileHover={{ y: -3 }}
            >
              <img
                src={b.imageUrl}
                className="h-44 w-full object-cover object-center"
                alt={b.title}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{b.title}</h3>
                  <StatusBadge
                    tone={b.active ? 'success' : 'neutral'}
                    label={b.active ? 'Active' : 'Inactive'}
                  />
                </div>
                <StatusBadge
                  tone="neutral"
                  label={b.placement === 'CATEGORY' ? 'Promotion banner' : 'Homepage'}
                />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {b.description}
                </p>
                {b.link && (
                  <a
                    href={b.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-primary-600 underline dark:text-primary-400"
                  >
                    {b.link}
                  </a>
                )}
                <button
                  className="btn-premium-danger mt-3 flex items-center gap-1"
                  onClick={() => setDeleting(b)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete banner?"
        message={`"${deleting?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        isPending={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </PortalPage>
  );
}