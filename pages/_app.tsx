import '@/styles/globals.css';
import '@/styles/nprogress.css';
import type { AppProps } from 'next/app';
import Router from 'next/router';
import NProgress from 'nprogress';

// Configure NProgress
NProgress.configure({
  minimum: 0.3,
  easing: 'ease',
  speed: 500,
  showSpinner: false,
});

// Bind NProgress to Next.js router events
Router.events.on('routeChangeStart', () => NProgress.start());
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
