declare module 'katex/contrib/auto-render' {
  import type { KatexOptions } from 'katex';

  interface AutoRenderOptions extends Partial<KatexOptions> {
    delimiters?: Array<{ left: string; right: string; display: boolean }>;
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (msg: string, err: Error) => void;
    preProcess?: (math: string) => string;
  }

  function renderMathInElement(elem: HTMLElement, options?: AutoRenderOptions): void;
  export default renderMathInElement;
}
