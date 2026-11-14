// Illustrative entrypoint only. Brightdesk Extensions has no runtime or loader.
// This file is deliberately not imported, evaluated or executed by the validator.
export function activate(context) {
  return { status: 'example-only', contextType: typeof context };
}
