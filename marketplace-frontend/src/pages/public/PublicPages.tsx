import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Minus, Plus, ShoppingBag, ShoppingCart, Tag } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import api from '@/lib/axios';
import { useCategories } from '@/lib/categories';
import { getEffectivePrice } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import type { Banner, MyCoupon, PagedResponse, Product, PublicCoupon, Review } from '@/types';
import { Empty, LoadingBlock, Page, ProductGrid, RatingStars, StockBadge, dt, money, pageOf, unwrap } from '@/pages/pageShared';
import { fadeInUp, slideInLeft, slideInRight, staggerContainer } from '@/lib/motion';

export function HomePage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const { data: activeCategories } = useCategories();
  const categories = ['All', ...(activeCategories?.map((category) => category.name) ?? [])];
  const { data: coupons } = useQuery({
    queryKey: ['public-coupons'],
    queryFn: () => api.get('/public/coupons/active', { params: { page: 0, size: 6 } }).then((r) => unwrap<PagedResponse<PublicCoupon>>(r)),
  });

  return (
    <Page title="ApexHK">
      <HeroBanner />

      <div className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <motion.button
            key={cat}
            className="relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setActiveCategory(cat)}
          >
            {activeCategory === cat && <motion.span layoutId="activePill" className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-indigo to-accent-purple" />}
            <span className={`relative ${activeCategory === cat ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{cat}</span>
          </motion.button>
        ))}
      </div>

      <CategoryBanner />

      {pageOf(coupons).length > 0 && (
        <motion.div className="mb-8 grid gap-3 md:grid-cols-3" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {pageOf(coupons).map((c) => (
            <motion.div key={c.id} variants={fadeInUp} className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm dark:border-primary-500/20 dark:bg-primary-500/10">
              <p className="font-semibold text-primary-900 dark:text-primary-100">{c.description}</p>
              <p className="mt-1 text-primary-700 dark:text-primary-300">
                {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `${money(c.discountValue)} off`} · Min order {money(c.minimumOrderValue)}
                {c.maxDiscount ? ` · Up to ${money(c.maxDiscount)} off` : ''} · Expires {dt(c.expiresAt)}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      <h2 className="mb-4 text-xl font-semibold">{activeCategory === 'All' ? 'All products' : activeCategory}</h2>
      <ProductGrid endpoint={activeCategory === 'All' ? '/products' : `/products/category/${encodeURIComponent(activeCategory)}`} queryKey={['products', 'all', activeCategory]} />
    </Page>
  );
}

export function ProductsPage() {
  return <Page title="Products"><ProductGrid endpoint="/products" queryKey={['products']} /></Page>;
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  return (
    <Page title={q ? `Search results for "${q}"` : 'Search'}>
      <ProductGrid
        endpoint={`/products/search?q=${encodeURIComponent(q)}`}
        queryKey={['products', 'search', q]}
        emptyTitle={q ? `No products found for "${q}".` : 'Search for products to get started.'}
      />
    </Page>
  );
}

export function CategoryPage() {
  const { category = '' } = useParams();
  return <Page title={decodeURIComponent(category)}><ProductGrid endpoint={`/products/category/${encodeURIComponent(category)}`} queryKey={['products', 'category', category]} /></Page>;
}

/**
 * Small "Use CODE for X% off" chip shown near a product's price when any of the
 * customer's coupons has minimumOrderValue <= this product's effective price.
 * Purely informational — filtering happens client-side against /coupons/mine,
 * the same data the cart/checkout coupon cards use; no discount math lives here.
 */
function ProductCouponChip({ coupons, price }: { coupons?: MyCoupon[]; price: number }) {
  if (!coupons?.length) return null;
  const candidates = coupons.filter((c) => c.minimumOrderValue <= price);
  if (!candidates.length) return null;
  // Prefer the coupon that would actually be eligible right now, then the biggest discount.
  const best = [...candidates].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.discountValue - a.discountValue;
  })[0];
  const offText = best.discountType === 'PERCENTAGE' ? `${best.discountValue}% off` : `${money(best.discountValue)} off`;

  return (
    <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
      <Tag className="h-3 w-3" /> Use {best.code} for {offText}
    </div>
  );
}

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<'Description' | 'Reviews' | 'Specifications'>('Description');
  const [ripples, setRipples] = useState(0);
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => unwrap<Product>(r)),
    enabled: !!id,
  });
  const { data: reviews } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => api.get(`/reviews/product/${id}`, { params: { page: 0, size: 8 } }).then((r) => unwrap<PagedResponse<Review>>(r)),
    enabled: !!id,
  });
  // Reuse the same /coupons/mine data as cart/checkout, filtered client-side for this
  // product's price — just a visibility hint, no discount math happens here.
  const { data: myCoupons } = useQuery({
    queryKey: ['my-coupons'],
    queryFn: () => api.get('/coupons/mine').then((r) => unwrap<MyCoupon[]>(r)),
    enabled: !!user && user.role === 'CUSTOMER',
  });
  const add = useMutation({
    mutationFn: () => api.post('/cart/items', { productId: id, quantity: qty }),
    onSuccess: () => {
      setRipples((n) => n + 1);
      toast.success('Added to cart');
      qc.invalidateQueries({ queryKey: ['cart'] });
    },
  });
  const handleAddToCart = (checkout = false) => {
    if (!user) {
      toast.error('Please log in to buy this product');
      navigate('/login');
      return;
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customer accounts can buy products');
      return;
    }
    add.mutate(undefined, {
      onSuccess: () => {
        if (checkout) navigate('/cart');
      },
    });
  };
  if (isLoading || !product) return <Page title="Product"><LoadingBlock /></Page>;
  const images = product.imageUrls?.length ? product.imageUrls : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1200&auto=format&fit=crop'];
  const price = getEffectivePrice(product);

  return (
    <Page title={product.name}>
      <div className="grid gap-8 lg:grid-cols-2">
        <motion.div variants={slideInLeft} initial="hidden" animate="visible">
          <img src={images[active]} alt={product.name} className="aspect-square w-full rounded-lg object-cover shadow-card" />
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <motion.button key={src} onClick={() => setActive(i)} whileTap={{ scale: 0.9 }} className="relative rounded-lg">
                {i === active && <motion.span layoutId="selectedThumb" className="absolute inset-0 rounded-lg ring-2 ring-primary-600" />}
                <motion.img src={src} alt="" className="h-20 w-20 rounded-lg object-cover" whileHover={{ scale: 1.1 }} />
              </motion.button>
            ))}
          </div>
        </motion.div>
        <motion.div className="space-y-5" variants={slideInRight} initial="hidden" animate="visible">
          <p className="text-sm text-slate-500 dark:text-slate-400">{product.brand} · {product.category} · {product.vendorName}</p>
          <div className="flex items-center gap-3"><RatingStars value={product.averageRating} /><span className="text-sm text-slate-500">{product.totalReviews ?? 0} reviews</span></div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold">{money(price)}</span>
            {price < product.price && <span className="text-slate-400 line-through">{money(product.price)}</span>}
          </div>
          <ProductCouponChip coupons={myCoupons} price={price} />
          <StockBadge stock={product.stock} />
          <div className="flex gap-2 border-b border-border dark:border-border-dark">
            {(['Description', 'Reviews', 'Specifications'] as const).map((name) => (
              <button key={name} onClick={() => setTab(name)} className="relative px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {name}
                {tab === name && <motion.div layoutId="tabUnderline" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary-500" />}
              </button>
            ))}
          </div>
          <p className="text-slate-700 dark:text-slate-300">{tab === 'Specifications' ? `${product.brand} product in ${product.category}.` : product.description}</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-border dark:border-border-dark">
              <motion.button className="p-2" whileTap={{ scale: 0.85 }} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></motion.button>
              <span className="w-10 text-center text-sm font-semibold">{qty}</span>
              <motion.button className="p-2" whileTap={{ scale: 0.85 }} onClick={() => setQty((q) => Math.min(product.stock, q + 1))}><Plus className="h-4 w-4" /></motion.button>
            </div>
            <motion.button
              className="btn-premium relative overflow-hidden"
              disabled={product.stock === 0 || add.isPending}
              onClick={() => handleAddToCart()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <ShoppingCart className="h-4 w-4" /> Add to cart
              <AnimatePresence>
                {ripples > 0 && <motion.span key={ripples} className="absolute inset-0 rounded-xl bg-white/40" initial={{ scale: 0, opacity: 1 }} animate={{ scale: 3, opacity: 0 }} exit={{ opacity: 0 }} />}
              </AnimatePresence>
            </motion.button>
            <motion.button
              className="btn-premium-secondary"
              disabled={product.stock === 0 || add.isPending}
              onClick={() => handleAddToCart(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <ShoppingBag className="h-4 w-4" /> Buy now
            </motion.button>
          </div>
        </motion.div>
      </div>
      <section className="mt-10 grid gap-8 lg:grid-cols-[240px_1fr]">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Customer reviews</h2>
          <div className="flex items-center gap-2">
            <RatingStars value={product.averageRating} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{product.averageRating?.toFixed(1) ?? '0.0'} out of 5</span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{product.totalReviews ?? 0} global ratings</p>
        </div>

        <div className="divide-y divide-border dark:divide-border-dark">
          {pageOf(reviews).map((r) => (
            <motion.div key={r.id} className="py-5 first:pt-0" variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                  {r.customerName?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.customerName}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <RatingStars value={r.rating} />
                {r.title && <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.title}</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Reviewed in India on {dt(r.createdAt)} <span className="ml-1 font-medium text-primary-600 dark:text-primary-400">· Verified Purchase</span>
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{r.comment}</p>
              {!!r.imageUrls?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.imageUrls.map((src) => (
                    <img key={src} src={src} alt="Review attachment" className="h-16 w-16 rounded-lg border border-border object-cover dark:border-border-dark" />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
          {!pageOf(reviews).length && <Empty title="No reviews yet." />}
        </div>
      </section>
    </Page>
  );
}

function CategoryBanner() {
  const { data: banners } = useQuery({
    queryKey: ['public-banners', 'CATEGORY'],
    queryFn: () => api.get('/public/banners', { params: { placement: 'CATEGORY' } }).then((r) => unwrap<Banner[]>(r)),
  });
  const items = (banners ?? []).filter((item) => item.imageUrl && (item.active ?? item.isActive ?? true));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;
  const banner = items[index];

  const content = (
    <motion.div
      className="relative mb-8 h-40 w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 md:h-56"
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={banner.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="h-full w-full object-contain"
          />
          {(banner.title || banner.description) && (
            <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/60 to-transparent p-6">
              {banner.title && <h3 className="text-xl font-bold text-white md:text-2xl">{banner.title}</h3>}
              {banner.description && <p className="mt-1 max-w-md text-sm text-white/90">{banner.description}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {items.length > 1 && (
        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {items.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={(e) => { e.preventDefault(); setIndex(i); }}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
              aria-label={`Show banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );

  return banner.linkUrl ? <Link to={banner.linkUrl}>{content}</Link> : content;
}

function HeroBanner() {
  const { data: banners } = useQuery({
    queryKey: ['public-banners', 'HOME'],
    queryFn: () => api.get('/public/banners', { params: { placement: 'HOME' } }).then((r) => unwrap<Banner[]>(r)),
  });
  const heroRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const banner = banners?.find((item) => item.imageUrl);

  useEffect(() => {
    if (!heroRef.current || !canvasRef.current) return;
    const hero = heroRef.current;
    const canvas = canvasRef.current;

    const ctx = canvas.getContext('2d')!;
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;

    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.6 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    }));

    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.pulse += 0.02;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        const a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${250 + Math.sin(p.pulse * 0.5) * 30}, 80%, 70%, ${a})`;
        ctx.fill();
      });
    }

    function s(el: HTMLElement | null, st: Partial<CSSStyleDeclaration>) { if (el) Object.assign(el.style, st); }
    function anim(el: HTMLElement | null, st: Partial<CSSStyleDeclaration>, dur: number, delay = 0) {
      return new Promise<void>((res) => setTimeout(() => {
        if (!el) { res(); return; }
        el.style.transition = `all ${dur}ms cubic-bezier(0.25,0.46,0.45,0.94)`;
        Object.assign(el.style, st);
        setTimeout(res, dur);
      }, delay));
    }

    const positions = [
      { left: '60px', top: '130px' }, { left: '200px', top: '90px' }, { left: '350px', top: '130px' },
      { left: '100px', top: '290px' }, { left: '250px', top: '310px' }, { left: '410px', top: '280px' },
    ];

    function showScene(id: string) {
      hero.querySelectorAll<HTMLElement>('.hk-scene').forEach((sc) => { sc.style.opacity = '0'; sc.style.pointerEvents = 'none'; });
      const el = hero.querySelector<HTMLElement>(`#${id}`);
      if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'auto'; }
    }

    let stopped = false;

    async function run() {
      if (stopped) return;
      startTimeRef.current = performance.now();

      // Scene 1
      showScene('hk-s1');
      const bags = [['hk-bag1', { transform: 'translateX(-120px) translateY(-80px)', opacity: '0' }],
        ['hk-bag2', { transform: 'translateX(120px) translateY(-80px)', opacity: '0' }],
        ['hk-bag3', { transform: 'translateX(-60px) translateY(100px)', opacity: '0' }]] as const;
      bags.forEach(([id, st]) => s(hero.querySelector(`#${id}`), st as Partial<CSSStyleDeclaration>));
      s(hero.querySelector<HTMLElement>('#hk-logo'), { opacity: '0', transform: 'scale(0.85)' });
      await new Promise((r) => setTimeout(r, 100));
      if (stopped) return;
      anim(hero.querySelector('#hk-bag1'), { transform: 'translateX(0) translateY(0)', opacity: '1' }, 700);
      anim(hero.querySelector('#hk-bag2'), { transform: 'translateX(0) translateY(0)', opacity: '1' }, 700, 150);
      anim(hero.querySelector('#hk-bag3'), { transform: 'translateX(0) translateY(0)', opacity: '1' }, 700, 300);
      await anim(hero.querySelector('#hk-logo'), { opacity: '1', transform: 'scale(1)' }, 800, 500);
      await new Promise((r) => setTimeout(r, 800));
      if (stopped) return;

      // Scene 2
      showScene('hk-s2');
      const cards = hero.querySelectorAll<HTMLElement>('.hk-prod');
      cards.forEach((c, i) => { Object.assign(c.style, positions[i]); s(c, { opacity: '0', transform: 'translateY(40px) scale(0.8)' }); });
      await new Promise((r) => setTimeout(r, 80));
      if (stopped) return;
      await Promise.all(Array.from(cards).map((c, i) => anim(c, { opacity: '1', transform: 'translateY(0) scale(1)' }, 500, i * 130)));
      await new Promise((r) => setTimeout(r, 1200));
      if (stopped) return;

      // Scene 3
      showScene('hk-s3');
      const cartEl = hero.querySelector<HTMLElement>('#hk-cart');
      s(cartEl, { opacity: '0', transform: 'scale(0.5)' });
      const feats = ['hk-f1', 'hk-f2', 'hk-f3'].map((id) => hero.querySelector<HTMLElement>(`#${id}`));
      const discs = ['hk-d1', 'hk-d2', 'hk-d3'].map((id) => hero.querySelector<HTMLElement>(`#${id}`));
      discs.forEach((d) => s(d, { opacity: '0', transform: 'scale(0.8)' }));
      feats.forEach((f) => s(f, { opacity: '0', transform: 'translateY(20px)' }));
      await anim(cartEl, { opacity: '1', transform: 'scale(1)' }, 500, 100);
      if (stopped) return;
      let p = 0;
      const pulse = setInterval(() => { if (cartEl) cartEl.style.transform = `scale(${1 + 0.08 * Math.sin(p++ * 0.4)})`; if (p > 40) clearInterval(pulse); }, 50);
      discs.forEach((d, i) => anim(d, { opacity: '1', transform: 'scale(1)' }, 400, 300 + i * 200));
      feats.forEach((f, i) => anim(f, { opacity: '1', transform: 'translateY(0)' }, 400, 600 + i * 180));
      await new Promise((r) => setTimeout(r, 2200));
      if (stopped) return;
      discs.forEach((d) => anim(d, { opacity: '0', transform: 'scale(0.8)' }, 300));

      // Scene 4
      showScene('hk-s4');
      const els4 = ['hk-h1', 'hk-sub', 'hk-cta1', 'hk-cta2'].map((id) => hero.querySelector<HTMLElement>(`#${id}`));
      els4.forEach((el) => s(el, { opacity: '0', transform: 'translateY(24px)' }));
      for (const el of els4) { await anim(el, { opacity: '1', transform: 'translateY(0)' }, 500, 80); if (stopped) return; }
      await new Promise((r) => setTimeout(r, 900));
      if (!stopped) run();
    }

    function loop(ts: number) {
      if (stopped) return;
      drawParticles();
      if (startTimeRef.current) {
        const elapsed = (ts - startTimeRef.current) % 10000;
        const bar = hero.querySelector<HTMLElement>('#hk-bar');
        if (bar) bar.style.width = (elapsed / 10000 * 100) + '%';
      }
      const cards = hero.querySelectorAll<HTMLElement>('.hk-prod');
      cards.forEach((c, i) => {
        if (c.style.opacity === '1') {
          const t = Date.now() * 0.001 + i * 0.8;
          const base = parseInt(positions[i]?.top || '0');
          c.style.top = `${base + Math.sin(t) * 7}px`;
        }
      });
      const t = ts * 0.001;
      const o1 = hero.querySelector<HTMLElement>('#hk-orb1');
      const o2 = hero.querySelector<HTMLElement>('#hk-orb2');
      if (o1) o1.style.transform = `translate(${Math.sin(t * 0.4) * 20}px,${Math.cos(t * 0.3) * 15}px)`;
      if (o2) o2.style.transform = `translate(${Math.cos(t * 0.35) * 18}px,${Math.sin(t * 0.4) * 12}px)`;
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    run();

    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  }, []);

  if (banner) {
    const content = (
      <motion.div
        className="relative mb-8 min-h-[260px] overflow-hidden rounded-2xl bg-slate-900 md:min-h-[360px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <img
          src={banner.imageUrl}
          alt={banner.title}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
        <div className="relative flex min-h-[260px] max-w-2xl flex-col justify-end p-6 md:min-h-[360px] md:p-10">
          <h1 className="text-3xl font-bold text-white md:text-5xl">{banner.title}</h1>
          {banner.description && (
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/85 md:text-base">
              {banner.description}
            </p>
          )}
        </div>
      </motion.div>
    );

    return banner.linkUrl ? <Link to={banner.linkUrl}>{content}</Link> : content;
  }

  return (
    <div
      ref={heroRef}
      className="relative mb-8 overflow-hidden rounded-2xl"
      style={{ height: '480px', background: '#05050f' }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <div id="hk-orb1" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'rgba(139,92,246,0.18)', filter: 'blur(60px)', top: -80, left: -60, pointerEvents: 'none' }} />
      <div id="hk-orb2" style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'rgba(59,130,246,0.14)', filter: 'blur(60px)', bottom: -80, right: -40, pointerEvents: 'none' }} />

      {/* Scene 1 — Logo */}
      <div id="hk-s1" className="hk-scene" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, pointerEvents: 'none' }}>
        {[['hk-bag1', '🛍️', { top: 60, left: 60 }], ['hk-bag2', '🛒', { top: 60, right: 80 }], ['hk-bag3', '🎁', { bottom: 70, left: 120 }]].map(([id, icon, pos]) => (
          <div key={id as string} id={id as string} style={{ position: 'absolute', fontSize: 48, ...pos as object }}>
            {icon as string}
          </div>
        ))}
        <div id="hk-logo" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: '#fff', fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: -1 }}>
            Apex<span style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HK</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', letterSpacing: 4, marginTop: 4 }}>YOUR TRUSTED SHOPPING DESTINATION</div>
        </div>
      </div>

      {/* Scene 2 — Products */}
      <div id="hk-s2" className="hk-scene" style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}>
        {[['📱','Electronics'],['👗','Fashion'],['📚','Books'],['⚽','Sports'],['💄','Beauty'],['🧸','Toys']].map(([icon, name], i) => (
          <div key={name} className="hk-prod" style={{
            position: 'absolute', width: 110, height: 130, borderRadius: 16, opacity: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.08)',
          }}>
            <div style={{ fontSize: 34 }}>{icon}</div>
            <div style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 600 }}>{name}</div>
          </div>
        ))}
      </div>

      {/* Scene 3 — Shopping */}
      <div id="hk-s3" className="hk-scene" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, opacity: 0, pointerEvents: 'none' }}>
        {[['hk-d1','🏷️ 40% OFF',{top:90,left:80}],['hk-d2','🔥 Best Deal',{top:110,right:90}],['hk-d3','✨ Free Ship',{bottom:110,left:160}]].map(([id,label,pos]) => (
          <div key={id as string} id={id as string} style={{ position: 'absolute', background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: '#fff', opacity: 0, ...pos as object }}>
            {label as string}
          </div>
        ))}
        <div id="hk-cart" style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '2px solid #8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>🛒</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[['hk-f1','🔒 Secure Payment'],['hk-f2','🚚 Fast Delivery'],['hk-f3','⭐ Trusted Vendors']].map(([id,label]) => (
            <div key={id as string} id={id as string} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 999, padding: '8px 16px', fontSize: 12, color: '#93c5fd', opacity: 0 }}>
              {label as string}
            </div>
          ))}
        </div>
      </div>

      {/* Scene 4 — Hero CTA */}
      <div id="hk-s4" className="hk-scene" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '0 40px', opacity: 0, pointerEvents: 'none' }}>
        <div id="hk-h1" style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.2, opacity: 0 }}>
          Shop from{' '}
          <span style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Trusted Vendors</span>
          <br />Across India
        </div>
        <div id="hk-sub" style={{ fontSize: 14, color: '#94a3b8', maxWidth: 480, lineHeight: 1.6, opacity: 0 }}>
          Discover electronics, fashion, home goods, books, and everyday essentials with secure checkout.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Link to="/products" id="hk-cta1" style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, textDecoration: 'none', opacity: 0 }}>
            Browse Products
          </Link>
          <Link to="/register" id="hk-cta2" style={{ background: 'transparent', color: '#c4b5fd', border: '1.5px solid rgba(139,92,246,0.5)', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600, textDecoration: 'none', opacity: 0 }}>
            Become a Vendor
          </Link>
        </div>
      </div>

      <div id="hk-bar" style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: 'linear-gradient(90deg,#8b5cf6,#3b82f6)', width: '0%', borderRadius: '0 2px 2px 0' }} />
    </div>
  );
}