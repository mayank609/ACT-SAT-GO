import type { ReactNode } from 'react';

/**
 * Student-produced response (SPR) directions, shown beside every numeric-entry
 * question, as in the College Board's Bluebook app.
 */
const EXAMPLES: { answer: ReactNode; ok: string[]; notOk: string[] }[] = [
  { answer: '3.5', ok: ['3.5', '3.50', '7/2'], notOk: ['31/2', '3 1/2'] },
  { answer: <Frac n="2" d="3" />, ok: ['2/3', '.6666', '.6667', '0.666', '0.667'], notOk: ['0.66', '.66', '0.67', '.67'] },
  { answer: <>−<Frac n="1" d="3" /></>, ok: ['-1/3', '-.3333', '-0.333'], notOk: ['-.33', '-0.33'] },
];

function Frac({ n, d }: { n: string; d: string }) {
  return (
    <span className="inline-flex flex-col items-center align-middle leading-none text-[13px]">
      <span className="border-b border-gray-800 px-0.5">{n}</span>
      <span className="px-0.5">{d}</span>
    </span>
  );
}

export function SprDirections() {
  return (
    <div className="text-[14px] text-gray-800 leading-relaxed">
      <h2 className="text-base font-bold text-gray-900 mb-3">Student-produced response directions</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>If you find <b>more than one correct answer</b>, enter only one answer.</li>
        <li>You can enter up to 5 characters for a <b>positive</b> answer and up to 6 characters (including the negative sign) for a <b>negative</b> answer.</li>
        <li>If your answer is a <b>fraction</b> that doesn't fit in the provided space, enter the decimal equivalent.</li>
        <li>If your answer is a <b>decimal</b> that doesn't fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>
        <li>If your answer is a <b>mixed number</b> (such as 3<Frac n="1" d="2" />), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).</li>
        <li>Don't enter <b>symbols</b> such as a percent sign, comma, or dollar sign.</li>
      </ul>

      <p className="mt-5 mb-2 font-semibold text-center text-gray-900">Examples</p>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-1.5 font-semibold text-left">Answer</th>
            <th className="border border-gray-300 px-2 py-1.5 font-semibold text-left">Acceptable ways to enter answer</th>
            <th className="border border-gray-300 px-2 py-1.5 font-semibold text-left">Unacceptable: will NOT receive credit</th>
          </tr>
        </thead>
        <tbody>
          {EXAMPLES.map((ex, i) => (
            <tr key={i} className="align-top">
              <td className="border border-gray-300 px-2 py-1.5 text-center">{ex.answer}</td>
              <td className="border border-gray-300 px-2 py-1.5 font-mono">{ex.ok.map((v) => <div key={v}>{v}</div>)}</td>
              <td className="border border-gray-300 px-2 py-1.5 font-mono">{ex.notOk.map((v) => <div key={v}>{v}</div>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
