export interface ErrorReporter {
  capture(
    error: Error,
    context: Record<string, string | number | boolean>,
  ): void;
}
let reporter: ErrorReporter = {
  capture: (error, context) =>
    console.error(
      JSON.stringify({
        event: "application_error",
        type: error.name,
        ...context,
      }),
    ),
};
export const configureErrorReporter = (next: ErrorReporter) => {
  reporter = next;
};
export const reportError = (
  error: Error,
  context: Record<string, string | number | boolean> = {},
) => reporter.capture(error, context);
