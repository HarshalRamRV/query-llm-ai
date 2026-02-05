declare module 'expr-eval' {
  export class Parser {
    constructor(options?: Record<string, unknown>);
    evaluate(expression: string, variables?: Record<string, number>): unknown;
  }
}
