import { useId } from 'react';
import type { ReactNode } from 'react';

const forms: Record<string, ReactNode> = {
  moonlight: <>
    <path d="M56 51C42 27 20 25 16 39c-3 12 14 24 35 25-18 3-24 14-18 22 10 7 21-5 24-19M64 51c14-24 36-26 40-12 3 12-14 24-35 25 18 3 24 14 18 22-10 7-21-5-24-19" fill="#8aac98" />
    <path d="M49 48C34 34 27 37 29 43c2 8 9 12 20 13M71 48c15-14 22-11 20-5-2 8-9 12-20 13" fill="#d8dfb8" />
    <path d="M43 40c-7 0-9 9-2 12-3-4-1-9 2-12M77 40c7 0 9 9 2 12 3-4 1-9-2-12" fill="#294d43" stroke="none" />
    <path d="m56 47-9-12m17 12 9-12M53 70 42 82m25-12 11 12" fill="none" />
    <ellipse cx="60" cy="64" rx="5" ry="21" fill="#d6c99c" /><path d="M57 55h6m-7 8h8m-7 8h6" />
  </>,
  'little-light': <>
    <path d="M54 53C32 25 19 41 32 61l18 11M66 53c22-28 35-12 22 8L70 72" fill="#a3bf9b" fillOpacity=".65" />
    <path d="m47 63-14 4-7 14m47-18 14 4 7 14M47 72l-12 9m38-9 12 9m-30-38-8-11m18 11 8-11" fill="none" />
    <ellipse cx="60" cy="69" rx="13" ry="22" fill="#dcc988" /><path d="M47 68h26m-25 8h24m-20 8h16" stroke="#b39e64" />
    <path d="M48 65V54c0-13 24-13 24 0v11l-12 6Z" fill="#385d46" /><path d="M60 51v20" />
    <circle cx="60" cy="44" r="7" fill="#a9ba8e" /><circle cx="57" cy="42" r="1" fill="#182e25" /><circle cx="63" cy="42" r="1" fill="#182e25" />
    <path d="m30 26 2-6 2 6 6 2-6 2-2 6-2-6-6-2Zm55 68 1-4 2 4 4 2-4 1-2 4-1-4-4-1Z" fill="#dfd4a3" stroke="none" />
  </>,
  'jade-skin': <>
    <path d="m44 46-13-4-8 7m53-3 13-4 8 7M42 60l-15 4-7 11m58-15 15 4 7 11M45 76l-10 12v10m40-22 10 12v10m-30-62-8-10m18 10 8-10" fill="none" />
    <path d="M59 33c-28 0-30 43 1 60 31-17 29-60 1-60Z" fill="#77ad92" />
    <path d="m60 41-16 15 4 20 12 10 12-10 4-20Z" fill="#bdd1ac" /><path d="m60 41-1 21-15-6m15 6-11 14m11-14 1 24m-1-24 17-6m-17 6 13 14" fill="none" stroke="#6c9e82" />
    <path d="M49 38c1-15 21-15 22 0Z" fill="#4d785e" /><path d="M49 44c-9 9-10 22-1 34" fill="none" stroke="#e4e5c0" opacity=".65" />
  </>,
  'white-boar': <>
    <path d="m45 52-15-8-9 5m55 3 15-8 9 5M42 65l-18 5-6 12m60-17 18 5 6 12M44 80 34 94m42-14 10 14" fill="none" />
    <ellipse cx="60" cy="65" rx="22" ry="26" fill="#c8ccb0" /><path d="M60 43v48M44 55l12 3m8 0 12-3M41 69l15 3m8 0 15-3M46 83l10-3m8 0 10 3" fill="none" stroke="#82957c" />
    <path d="M47 44c-5-10 1-16 13-16s18 6 13 16Z" fill="#869d80" />
    <path d="M49 37c-13-3-17-13-11-20-1 8 6 12 14 11m19 9c13-3 17-13 11-20 1 8-6 12-14 11" fill="#e2dcc0" />
    <path d="m51 34 4 2m10 0 4-2" stroke="#253d2e" strokeWidth="2.5" />
  </>,
  'liquor-worm': <>
    <path d="M85 57c12 13 0 35-24 34-30 0-39-13-34-30 2-8 13-9 15-1-7 14 3 19 17 18 14-1 14-8 12-14" fill="#d4d5b2" strokeWidth="2" />
    <path d="m29 65 11 2m-9 8 11-5m-5 12 9-7m0 12 5-10m5 12 1-10m9 9-2-10m13 5-7-8m13-1-10-4" fill="none" stroke="#94a789" />
    <ellipse cx="78" cy="55" rx="12" ry="14" transform="rotate(-25 78 55)" fill="#e0ddba" />
    <path d="m75 42-2-11m10 14 8-8" fill="none" /><circle cx="73" cy="31" r="2.5" fill="#cebe83" /><circle cx="91" cy="37" r="2.5" fill="#cebe83" />
    <circle cx="74" cy="51" r="1.7" fill="#304b38" /><circle cx="82" cy="53" r="1.7" fill="#304b38" /><path d="m76 60 4 1" fill="none" />
    <path d="M44 24s-9 10-9 15a9 9 0 0 0 18 0c0-5-9-15-9-15Z" fill="#b9a469" fillOpacity=".65" /><path d="M40 39c-1 3 1 5 3 5" stroke="#e1cf93" fill="none" />
  </>,
  'vitality-grass': <>
    <path d="M60 97V35m0 54L34 68m26 12 28-21M60 65 36 46m24 13 25-19M60 48 44 30m16 13 13-18" fill="none" />
    <path d="M60 38C45 26 52 16 60 10c10 12 12 19 0 28Z" fill="#c5c791" />
    <path d="M49 40C31 41 28 30 31 22c15 1 19 7 18 18Zm22-6c-1-14 8-19 17-17-1 13-5 18-17 17Z" fill="#a8ba83" />
    <path d="M49 57C28 62 21 50 22 39c16-1 27 5 27 18Zm21-6c0-18 11-22 26-20-4 16-11 22-26 20Z" fill="#82a782" />
    <path d="M46 76C24 80 17 69 19 56c20 0 27 8 27 20Zm25-6c2-18 17-24 30-17-7 16-16 20-30 17Z" fill="#659176" />
    <path d="M57 93C35 99 23 88 26 77c17-4 28 3 31 16Zm8-7c10-17 21-17 30-10-6 13-15 15-30 10Z" fill="#769d79" />
    <path d="m60 97-10 10m10-10 1 12m-1-12 12 7" fill="none" stroke="#a69f75" />
  </>,
  'earth-ear': <>
    <path d="M60 97V66m-1 22-21 12m23-12 19 13m-20-4-7 12m8-12 6 13" fill="none" stroke="#adac80" />
    <path d="M61 76C36 82 19 60 25 35c4-16 23-23 39-14 17-11 35-1 34 20-1 20-23 36-37 35Z" fill="#91ac83" />
    <path d="M57 72C35 62 32 43 43 33c8-7 21-3 21 10 0 13-16 15-15 5m14 22c20-13 28-28 19-35-9-6-13 5-8 11" fill="none" stroke="#d0d0a1" strokeWidth="2.5" />
    <path d="m59 67-8-9m18 7 8-7M39 87c-12 2-19-2-24-11 11-2 21 1 24 11Zm40 4c11-1 19-7 20-16-14 3-18 7-20 16Z" fill="#547e64" />
  </>,
  'flower-bag': <>
    <path d="M61 105V48m0 42-22-16m22 8 21-18" fill="none" />
    <path d="M43 77C24 82 17 73 18 61c13 0 22 5 25 16Zm35-5c5-18 18-22 27-17-3 15-12 21-27 17Z" fill="#759a72" />
    <path d="M43 46c1 17-10 30 2 43 8 10 25 10 33-1 9-14-2-28-1-42" fill="#91ab80" />
    <path d="M48 53c-1 13-9 27 2 34m16-34c2 19 10 27 1 37M55 57v33" fill="none" stroke="#cad0a0" opacity=".7" />
    <path d="M59 45c-16-2-24-9-19-19 13-6 22 8 20 17-4-14 1-26 12-25 11 7 3 21-9 27 17-10 30-5 28 8-10 11-25 2-29-7-2 17-15 22-21 11-1-6 9-11 18-12Z" fill="#c8bd8c" />
    <ellipse cx="61" cy="47" rx="15" ry="7" fill="#46634b" /><ellipse cx="61" cy="47" rx="9" ry="3" fill="#263e32" />
  </>,
  'jumping-grass': <>
    <path d="m38 68-15 18 7 13m31-30 17 29 17-8m-25-32 16-22 19 4" fill="none" strokeWidth="2.5" />
    <path d="M36 64c18-17 30-22 50-14L70 66 42 75Z" fill="#7fa371" /><path d="m39 68 40-15-14 10-26 5Z" fill="#c0c791" />
    <path d="M58 71 49 89 31 90l17-8 2-13M72 63l19 11-4 26-5-22-19-11" fill="#a5b484" />
    <path d="M78 52c-1-14 14-23 21-13 5 10-3 23-11 20Z" fill="#bad09a" /><circle cx="91" cy="45" r="3" fill="#314f36" />
    <path d="m91 37 4-15m-9 17-4-15M29 83 16 70m10 22-14-5" fill="none" />
    <path d="M43 63C21 59 15 45 18 27c17 7 28 16 25 36Z" fill="#5e8d68" /><path d="m21 35 20 25" fill="none" stroke="#bad09a" />
  </>,
  'moon-glow': <>
    <path d="M57 50C39 23 12 14 12 36c0 21 24 29 41 28-24 5-30 22-14 28 13-1 18-14 20-25m4-17c18-27 45-36 45-14 0 21-24 29-41 28 24 5 30 22 14 28-13-1-18-14-20-25" fill="#bec99e" />
    <path d="M45 40c-13-7-21-4-21 4 0 10 11 17 22 15-10-3-15-14-1-19Zm30 0c13-7 21-4 21 4 0 10-11 17-22 15 10-3 15-14 1-19Z" fill="#526d58" />
    <path d="m36 80 14-8m34 8-14-8m-15-28-8-17m18 17 8-17" fill="none" stroke="#eee0b3" />
    <path d="m60 44 6 17-6 33-6-33Z" fill="#ddca8d" /><path d="M58 57h4m-5 7h6m-5 8h4" />
    <path d="m60 13 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#dfcd94" stroke="none" />
  </>,
  'white-jade': <>
    <path d="m44 48-16-7-8 8m56-1 16-7 8 8M40 64l-17 6-5 12m62-18 17 6 5 12M47 82 34 97m39-15 13 15" fill="none" />
    <path d="M59 32c-33 0-33 48 1 66 34-18 34-66 1-66Z" fill="#d2d6b5" />
    <path d="m60 39-19 15 4 24 15 13 15-13 4-24Z" fill="#9db69a" /><path d="m60 45-11 12 3 17 8 11 8-11 3-17Z" fill="#dee1c1" />
    <path d="m60 45-1 20-10-8m10 8-7 9m7-9 1 20m-1-20 12-8m-12 8 9 9" fill="none" stroke="#8fab94" />
    <path d="M47 36c-8-5-12-12-7-20 0 7 7 9 13 9m20 11c8-5 12-12 7-20 0 7-7 9-13 9" fill="#dfd6af" />
    <path d="M50 34c1-12 19-12 20 0Z" fill="#7c9d84" />
  </>,
  'moon-mark': <>
    <path d="M57 51C32 16 11 23 16 45c4 15 22 19 38 18-20 12-24 28-8 31 9-5 11-18 13-27m4-16c25-35 46-28 41-6-4 15-22 19-38 18 20 12 24 28 8 31-9-5-11-18-13-27" fill="#92b6a3" />
    <path d="M44 37c-20-7-22 11-6 17m7-7c-10-5-15 3-7 8m38-18c20-7 22 11 6 17m-7-7c10-5 15 3 7 8" fill="none" stroke="#dce0b9" strokeWidth="2.4" />
    <path d="m40 81 12-11m28 11-12-11M55 44l-9-16m19 16 9-16" fill="none" />
    <ellipse cx="60" cy="64" rx="5" ry="24" fill="#e0d5a6" /><path d="M57 53h6m-7 9h8m-7 9h6m-5 8h4" />
    <path d="M17 71c0 15 9 28 24 33M103 71c0 15-9 28-24 33" fill="none" stroke="#c6c18c" strokeDasharray="2 5" opacity=".6" />
  </>,
};

/** Original decorative illustrations; visible Gu names remain the primary label. */
export default function GuArtwork({ guId, className = '' }: { guId: string; className?: string }) {
  const id = useId();
  return <svg className={`gu-artwork ${className}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <defs><radialGradient id={`${id}-halo`}><stop stopColor="#9fbb81" stopOpacity=".22" /><stop offset="1" stopColor="#73976e" stopOpacity="0" /></radialGradient></defs>
    <circle cx="60" cy="60" r="58" fill={`url(#${id}-halo)`} />
    <circle cx="60" cy="60" r="48" fill="none" stroke="#a6b286" strokeOpacity=".18" strokeDasharray="1 7" />
    <path d="M60 7v6m0 94v6M7 60h6m94 0h6" stroke="#c6be8a" strokeOpacity=".4" />
    <g stroke="#3f604b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{forms[guId] ?? forms['little-light']}</g>
  </svg>;
}
