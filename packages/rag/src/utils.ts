import { Array, Option, pipe, Record, String } from "effect";

export const normalizeWhitespace = (text: string) =>
  pipe(
    text,
    String.replaceAll(/\r\n/g, "\n"),
    String.replaceAll(/[\t\f\v]+/g, " "),
    String.replaceAll(/[ ]{2,}/g, " "),
    String.replaceAll(/\n{3,}/g, "\n\n"),
    String.trim,
  );

export const getFileExtension = (fileName: string) =>
  pipe(fileName, String.split("."), (parts) =>
    parts.length < 2
      ? ""
      : pipe(
          parts,
          Array.last,
          Option.getOrElse(() => ""),
          String.toLowerCase,
          (extension) => `.${extension}`,
        ),
  );

export const resolveMimeTypeForFile = (fileName: string) => {
  const extension = getFileExtension(fileName);
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
  } as const;

  return pipe(
    mimeTypes,
    Record.get(extension as keyof typeof mimeTypes),
    Option.getOrElse(() => "application/octet-stream"),
  );
};
