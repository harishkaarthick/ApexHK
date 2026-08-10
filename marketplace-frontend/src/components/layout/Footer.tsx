import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCategories } from '@/lib/categories';

export default function Footer() {
  const { data: categories = [] } = useCategories();
  const shopLinks: [string, string][] = [
    ['All Products', '/products'],
    ...categories.slice(0, 2).map((category) => [category.name, `/category/${encodeURIComponent(category.name)}`] as [string, string]),
  ];

  return (
    <footer className="mt-12 border-t border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
      <motion.div
        className="mx-auto max-w-7xl px-4 py-10"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h3 className="font-brand mb-3 text-lg">Apex<span className="bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">HK</span></h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Multi-vendor commerce with secure checkout, vendor portals, returns, and wallet credit.
            </p>
          </div>
          <FooterColumn title="Shop" links={shopLinks} />
          <FooterColumn title="Sell" links={[['Become a Vendor', '/register'], ['Vendor Portal', '/vendor/dashboard']]} />
          <FooterColumn title="Account" links={[['Sign In', '/login'], ['My Orders', '/account/orders'], ['Wallet', '/account/wallet']]} />
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-slate-400 dark:border-border-dark">
          © {new Date().getFullYear()} ApexHK. All rights reserved.
        </div>
      </motion.div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="hover:text-primary-600 dark:hover:text-primary-400">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
