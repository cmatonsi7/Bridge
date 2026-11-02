import { useMemo } from 'react';
import type { MouseEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

/**
 * Interaction handlers for the marketing pages migrated from the prototype.
 * The FAQ, billing toggle and Discover filters act on the static marketing markup exactly as the
 * prototype did (class toggles scoped to the clicked section). Phase 3 replaces the Discover cards
 * with Firestore data and a stateful component.
 */
export function useLegacyActions() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const signedIn = state.status === 'signedIn';

  return useMemo(() => {
    const go = (path: string) => () => navigate(path);

    const filterDiscover = (e: FormEvent | MouseEvent) => {
      const root = (e.currentTarget as HTMLElement).closest('section.page') ?? document;
      const q = ((root.querySelector('#discoverSearch') as HTMLInputElement | null)?.value ?? '')
        .toLowerCase()
        .trim();
      const active =
        (root.querySelector('.discover-tabs button.active') as HTMLElement | null)?.dataset.tab ?? 'all';
      let visible = 0;
      root.querySelectorAll<HTMLElement>('.discover-card').forEach((card) => {
        const show =
          (active === 'all' || card.dataset.type === active) && (!q || (card.dataset.name ?? '').includes(q));
        card.style.display = show ? 'block' : 'none';
        if (show) visible++;
      });
      const empty = root.querySelector<HTMLElement>('#discoverEmpty');
      if (empty) empty.style.display = visible ? 'none' : 'block';
    };

    return {
      go,
      register: go('/register'),
      signIn: go('/sign-in'),
      openApp: () => navigate(signedIn ? '/app' : '/register'),
      /** Supporting an athlete requires an account; the sponsorship flow itself arrives in Phase 3. */
      supportAthlete: () => navigate(signedIn ? '/app' : '/register'),
      toggleFaq: (e: MouseEvent<HTMLElement>) => {
        const btn = e.currentTarget;
        const item = btn.parentElement;
        if (!item) return;
        const scope = btn.closest('section') ?? document;
        const wasOpen = item.classList.contains('open');
        scope.querySelectorAll('.faq-item').forEach((x) => {
          x.classList.remove('open');
          const plus = x.querySelector('.plus');
          if (plus) plus.textContent = '+';
          x.querySelector('button')?.setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          item.classList.add('open');
          const plus = btn.querySelector('.plus');
          if (plus) plus.textContent = '−';
          btn.setAttribute('aria-expanded', 'true');
        }
      },
      toggleBilling: (e: MouseEvent<HTMLElement>) => {
        const btn = e.currentTarget;
        btn.parentElement?.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      },
      discoverTab: (_tab: string) => (e: MouseEvent<HTMLElement>) => {
        const btn = e.currentTarget;
        btn.parentElement?.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filterDiscover(e);
      },
      filterDiscover,
    };
  }, [navigate, signedIn]);
}
