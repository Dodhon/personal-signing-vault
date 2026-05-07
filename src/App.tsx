import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Calendar,
  Download,
  FileCheck2,
  FileInput,
  FileText,
  Fingerprint,
  Hash,
  PenLine,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type SignatureMode = "draw" | "type";
type FieldType = "signature" | "date" | "printedName" | "text";

type Placement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SigningField = {
  id: string;
  type: FieldType;
  label: string;
  value?: string;
  placement: Placement;
  pageNumber: number;
};

type PageMetrics = {
  pdfWidth: number;
  pdfHeight: number;
  previewWidth: number;
  previewHeight: number;
};

type Certificate = {
  app: string;
  version: string;
  documentName: string;
  signerName: string;
  signedAt: string;
  pageNumber: number;
  originalSha256: string;
  signedSha256: string;
  signatureMode: SignatureMode;
  fields: Array<{
    id: string;
    type: FieldType;
    label: string;
    value: string;
    pageNumber: number;
    placement: Placement;
  }>;
};

const fieldLabels: Record<FieldType, string> = {
  signature: "Signature",
  date: "Date",
  printedName: "Printed name",
  text: "Text",
};

const defaultPlacements: Record<FieldType, Placement> = {
  signature: {
    x: 0.16,
    y: 0.72,
    width: 0.34,
    height: 0.095,
  },
  date: {
    x: 0.58,
    y: 0.76,
    width: 0.22,
    height: 0.045,
  },
  printedName: {
    x: 0.16,
    y: 0.83,
    width: 0.34,
    height: 0.045,
  },
  text: {
    x: 0.16,
    y: 0.64,
    width: 0.34,
    height: 0.052,
  },
};

const today = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
}).format(new Date());

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function offsetPlacement(type: FieldType, index: number): Placement {
  const base = defaultPlacements[type];
  const offset = (index % 6) * 0.024;
  return {
    ...base,
    x: clamp(base.x + offset, 0.02, 1 - base.width - 0.02),
    y: clamp(base.y + offset, 0.02, 1 - base.height - 0.02),
  };
}

function createInitialFields(): SigningField[] {
  return [
    {
      id: "field-signature-1",
      type: "signature",
      label: fieldLabels.signature,
      placement: defaultPlacements.signature,
      pageNumber: 1,
    },
    {
      id: "field-printed-name-1",
      type: "printedName",
      label: fieldLabels.printedName,
      placement: defaultPlacements.printedName,
      pageNumber: 1,
    },
    {
      id: "field-date-1",
      type: "date",
      label: fieldLabels.date,
      placement: defaultPlacements.date,
      pageNumber: 1,
    },
  ];
}

function bytesToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function copyBytesToArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function sha256Hex(bytes: Uint8Array) {
  const source = copyBytesToArrayBuffer(bytes);
  const digest = await crypto.subtle.digest("SHA-256", source);
  return bytesToHex(digest);
}

function shortHash(hash?: string) {
  if (!hash) return "pending";
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(filename: string, suffix: string) {
  const base = filename.replace(/\.pdf$/i, "").replace(/[^a-z0-9-_]+/gi, "-");
  return `${base || "document"}-${suffix}`;
}

function fitFontSize(
  text: string,
  font: { widthOfTextAtSize: (value: string, size: number) => number },
  maxWidth: number,
  maxSize: number,
  minSize = 6,
) {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

async function createSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const heading = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const body = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  page.drawText("Volunteer Activity Waiver", {
    x: 58,
    y: 718,
    size: 22,
    font: heading,
    color: rgb(0.08, 0.1, 0.12),
  });
  page.drawText("Sample document for local signing workflow validation", {
    x: 58,
    y: 690,
    size: 10,
    font: body,
    color: rgb(0.36, 0.4, 0.44),
  });

  const copy = [
    "I understand that participation in this volunteer activity may involve ordinary risks",
    "including travel, physical movement, and contact with public spaces. I certify that I",
    "am voluntarily participating and that the information I provide is accurate.",
    "",
    "This sample is generated locally for testing the signing flow. It is not legal advice",
    "and should be replaced with the actual document before use.",
  ];

  copy.forEach((line, index) => {
    page.drawText(line, {
      x: 58,
      y: 636 - index * 20,
      size: 11,
      font: body,
      color: rgb(0.14, 0.16, 0.18),
    });
  });

  page.drawRectangle({
    x: 52,
    y: 120,
    width: 508,
    height: 112,
    borderWidth: 1,
    borderColor: rgb(0.78, 0.81, 0.84),
  });
  page.drawText("Signature", {
    x: 68,
    y: 201,
    size: 9,
    font: body,
    color: rgb(0.36, 0.4, 0.44),
  });
  page.drawLine({
    start: { x: 68, y: 172 },
    end: { x: 278, y: 172 },
    thickness: 0.8,
    color: rgb(0.56, 0.6, 0.64),
  });
  page.drawText("Date", {
    x: 336,
    y: 201,
    size: 9,
    font: body,
    color: rgb(0.36, 0.4, 0.44),
  });
  page.drawLine({
    start: { x: 336, y: 172 },
    end: { x: 492, y: 172 },
    thickness: 0.8,
    color: rgb(0.56, 0.6, 0.64),
  });
  page.drawText("Generated by Personal Signing Vault", {
    x: 58,
    y: 54,
    size: 9,
    font: italic,
    color: rgb(0.42, 0.45, 0.48),
  });

  return new Uint8Array(await pdfDoc.save());
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const fieldCounterRef = useRef(4);

  const [documentName, setDocumentName] = useState("");
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);
  const [originalHash, setOriginalHash] = useState("");
  const [signedHash, setSignedHash] = useState("");
  const [signedPdfBytes, setSignedPdfBytes] = useState<Uint8Array | null>(null);
  const [pageMetrics, setPageMetrics] = useState<PageMetrics | null>(null);
  const [fields, setFields] = useState<SigningField[]>(createInitialFields);
  const [activeFieldId, setActiveFieldId] = useState("field-signature-1");
  const [signerName, setSignerName] = useState("Thupten Wangpo");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [drawnSignatureDataUrl, setDrawnSignatureDataUrl] = useState("");
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draggedFieldId, setDraggedFieldId] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [statusMessage, setStatusMessage] = useState("Load a PDF to begin.");
  const [errorMessage, setErrorMessage] = useState("");

  const signatureLabel =
    signatureMode === "type" ? typedSignature.trim() : signerName.trim();

  const signatureReady =
    signatureMode === "type"
      ? typedSignature.trim().length > 0
      : hasDrawnSignature;

  const activeField = fields.find((field) => field.id === activeFieldId) ?? null;

  const getFieldValue = useCallback(
    (field: SigningField) => {
      if (field.type === "signature") return signatureLabel;
      if (field.type === "printedName") return signerName.trim();
      if (field.type === "date") return today;
      return field.value?.trim() ?? "";
    },
    [signatureLabel, signerName],
  );

  const fieldsReady =
    fields.length > 0 &&
    fields.every((field) => {
      if (field.type === "signature") return signatureReady;
      if (field.type === "text") return getFieldValue(field).length > 0;
      if (field.type === "printedName") return signerName.trim().length > 0;
      return true;
    });

  const canSign = Boolean(documentBytes) && fieldsReady;
  const canExport = canSign && Boolean(pageMetrics);

  const clearEvidence = useCallback(() => {
    setSignedHash("");
    setSignedPdfBytes(null);
    setCertificate(null);
  }, []);

  const loadPdfBytes = useCallback(async (name: string, bytes: Uint8Array) => {
    setErrorMessage("");
    setDocumentName(name);
    setDocumentBytes(bytes);
    setOriginalHash(await sha256Hex(bytes));
    setSignedHash("");
    setSignedPdfBytes(null);
    setCertificate(null);
    setFields(createInitialFields());
    setActiveFieldId("field-signature-1");
    fieldCounterRef.current = 4;
    setStatusMessage("PDF loaded. Place fields and export when ready.");
  }, []);

  useEffect(() => {
    if (!documentBytes || !previewCanvasRef.current) return;

    let cancelled = false;
    const bytes = documentBytes.slice();

    async function renderFirstPage() {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = previewCanvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);

        await page.render({
          canvasContext: context,
          viewport,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
        }).promise;

        if (!cancelled) {
          const [x1, y1, x2, y2] = page.view;
          setPageMetrics({
            pdfWidth: x2 - x1,
            pdfHeight: y2 - y1,
            previewWidth: viewport.width,
            previewHeight: viewport.height,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not render PDF.",
          );
          setStatusMessage("PDF preview failed.");
        }
      }
    }

    renderFirstPage();

    return () => {
      cancelled = true;
    };
  }, [documentBytes]);

  const loadSample = async () => {
    const sample = await createSamplePdf();
    await loadPdfBytes("sample-volunteer-waiver.pdf", sample);
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setErrorMessage("Choose a PDF file.");
      return;
    }
    await loadPdfBytes(file.name, new Uint8Array(await file.arrayBuffer()));
  };

  const getSignaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getSignaturePoint(event);
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!point || !canvas || !context) return;

    canvas.setPointerCapture(event.pointerId);
    context.strokeStyle = "#101820";
    context.lineWidth = 4.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
    setHasDrawnSignature(true);
    clearEvidence();
  };

  const drawSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const point = getSignaturePoint(event);
    const context = signatureCanvasRef.current?.getContext("2d");
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (signatureCanvasRef.current?.hasPointerCapture(event.pointerId)) {
      signatureCanvasRef.current.releasePointerCapture(event.pointerId);
    }
    if (hasDrawnSignature && signatureCanvasRef.current) {
      setDrawnSignatureDataUrl(signatureCanvasRef.current.toDataURL("image/png"));
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnSignature(false);
    setDrawnSignatureDataUrl("");
    clearEvidence();
  };

  const updateField = (id: string, changes: Partial<SigningField>) => {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...changes } : field,
      ),
    );
    clearEvidence();
  };

  const addField = (type: FieldType) => {
    const id = `field-${type}-${fieldCounterRef.current}`;
    fieldCounterRef.current += 1;
    const nextField: SigningField = {
      id,
      type,
      label: fieldLabels[type],
      value: type === "text" ? "Custom text" : undefined,
      placement: offsetPlacement(type, fields.length),
      pageNumber: 1,
    };

    setFields((current) => [...current, nextField]);
    setActiveFieldId(id);
    clearEvidence();
    setStatusMessage(`${fieldLabels[type]} field added.`);
  };

  const removeActiveField = () => {
    if (!activeField) return;
    const activeIndex = fields.findIndex((field) => field.id === activeField.id);
    const nextFields = fields.filter((field) => field.id !== activeField.id);
    setFields(nextFields);
    setActiveFieldId(nextFields[Math.max(0, activeIndex - 1)]?.id ?? "");
    clearEvidence();
  };

  const startFieldDrag = (
    field: SigningField,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!previewStageRef.current) return;
    const rect = previewStageRef.current.getBoundingClientRect();
    const currentX = field.placement.x * rect.width;
    const currentY = field.placement.y * rect.height;
    dragOffsetRef.current = {
      x: event.clientX - rect.left - currentX,
      y: event.clientY - rect.top - currentY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveFieldId(field.id);
    setDraggedFieldId(field.id);
  };

  const updateFieldFromPointer = (event: React.PointerEvent) => {
    if (!draggedFieldId || !previewStageRef.current) return;
    const rect = previewStageRef.current.getBoundingClientRect();
    const nextX =
      (event.clientX - rect.left - dragOffsetRef.current.x) / rect.width;
    const nextY =
      (event.clientY - rect.top - dragOffsetRef.current.y) / rect.height;

    setFields((current) =>
      current.map((field) => {
        if (field.id !== draggedFieldId) return field;
        return {
          ...field,
          placement: {
            ...field.placement,
            x: clamp(nextX, 0.02, 1 - field.placement.width - 0.02),
            y: clamp(nextY, 0.02, 1 - field.placement.height - 0.02),
          },
        };
      }),
    );
    clearEvidence();
  };

  const stopFieldDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggedFieldId("");
  };

  const exportSignedPdf = async () => {
    if (!documentBytes || !pageMetrics || !canExport) return;

    setErrorMessage("");
    setStatusMessage("Signing PDF locally...");

    try {
      const pdfDoc = await PDFDocument.load(documentBytes);
      const page = pdfDoc.getPages()[0];
      const { width: pdfWidth, height: pdfHeight } = page.getSize();

      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      const usesDrawnSignature =
        signatureMode === "draw" &&
        fields.some((field) => field.type === "signature");
      const signatureDataUrl =
        drawnSignatureDataUrl || signatureCanvasRef.current?.toDataURL("image/png");
      const signatureImage =
        usesDrawnSignature && signatureDataUrl
          ? await pdfDoc.embedPng(
              await fetch(signatureDataUrl).then((response) =>
                response.arrayBuffer(),
              ),
            )
          : null;
      const certificateFields: Certificate["fields"] = [];

      if (usesDrawnSignature && !signatureImage) {
        throw new Error("No drawn signature found.");
      }

      for (const field of fields) {
        const x = field.placement.x * pdfWidth;
        const boxWidth = field.placement.width * pdfWidth;
        const boxHeight = field.placement.height * pdfHeight;
        const y = pdfHeight - field.placement.y * pdfHeight - boxHeight;
        const value = getFieldValue(field);

        if (field.type === "signature") {
          if (signatureMode === "draw" && signatureImage) {
            page.drawImage(signatureImage, {
              x,
              y,
              width: boxWidth,
              height: boxHeight,
            });
          } else {
            const size = fitFontSize(
              value,
              italic,
              boxWidth,
              Math.min(34, boxHeight * 0.52),
              8,
            );
            page.drawText(value, {
              x,
              y: y + Math.max(3, (boxHeight - size) / 2),
              size,
              font: italic,
              color: rgb(0.04, 0.09, 0.11),
            });
          }
        } else {
          const font = field.type === "printedName" ? helveticaBold : helvetica;
          const size = fitFontSize(
            value,
            font,
            boxWidth - 4,
            Math.min(15, boxHeight * 0.54),
            6,
          );
          page.drawText(value, {
            x: x + 2,
            y: y + Math.max(2, (boxHeight - size) / 2),
            size,
            font,
            color:
              field.type === "date"
                ? rgb(0.12, 0.16, 0.18)
                : rgb(0.08, 0.12, 0.14),
          });
        }

        certificateFields.push({
          id: field.id,
          type: field.type,
          label: field.label,
          value:
            field.type === "signature" && signatureMode === "draw"
              ? "Drawn signature"
              : value,
          pageNumber: field.pageNumber,
          placement: field.placement,
        });
      }

      const signedBytes = new Uint8Array(await pdfDoc.save());
      const nextSignedHash = await sha256Hex(signedBytes);
      const signedAt = new Date().toISOString();
      const nextCertificate: Certificate = {
        app: "Personal Signing Vault",
        version: "0.1.0",
        documentName,
        signerName: signerName.trim(),
        signedAt,
        pageNumber: 1,
        originalSha256: originalHash,
        signedSha256: nextSignedHash,
        signatureMode,
        fields: certificateFields,
      };

      setSignedHash(nextSignedHash);
      setSignedPdfBytes(signedBytes);
      setCertificate(nextCertificate);
      setStatusMessage("Signed PDF and evidence certificate are ready.");

      downloadBlob(
        new Blob([signedBytes], { type: "application/pdf" }),
        `${safeFilename(documentName, "signed")}.pdf`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not sign PDF.",
      );
      setStatusMessage("Signing failed.");
    }
  };

  const downloadSignedPdf = () => {
    if (!signedPdfBytes) return;
    downloadBlob(
      new Blob([copyBytesToArrayBuffer(signedPdfBytes)], {
        type: "application/pdf",
      }),
      `${safeFilename(documentName, "signed")}.pdf`,
    );
  };

  const downloadCertificate = () => {
    if (!certificate) return;
    downloadBlob(
      new Blob([JSON.stringify(certificate, null, 2)], {
        type: "application/json",
      }),
      `${safeFilename(documentName, "certificate")}.json`,
    );
  };

  const completionLabel = useMemo(() => {
    if (!documentBytes) return "Import";
    if (!fields.length) return "Fields";
    if (!canSign) return "Fill";
    if (!signedHash) return "Evidence";
    return "Complete";
  }, [canSign, documentBytes, fields.length, signedHash]);

  const workflowSteps: Array<{
    label: string;
    Icon: LucideIcon;
    done: boolean;
  }> = [
    { label: "Import", Icon: FileInput, done: Boolean(documentBytes) },
    { label: "Fields", Icon: PenLine, done: fieldsReady },
    { label: "Evidence", Icon: FileCheck2, done: Boolean(signedHash) },
  ];

  const renderFieldPreview = (field: SigningField) => {
    const value = getFieldValue(field);
    if (
      field.type === "signature" &&
      signatureMode === "draw" &&
      drawnSignatureDataUrl
    ) {
      return (
        <img
          className="signature-image-preview"
          src={drawnSignatureDataUrl}
          alt="Drawn signature preview"
        />
      );
    }

    return (
      <span
        className={
          field.type === "signature" ? "signature-preview" : "field-value"
        }
      >
        {value || field.label}
      </span>
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1>Personal Signing Vault</h1>
            <p>{documentName || "No document loaded"}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className={`status-pill ${signedHash ? "ready" : ""}`}>
            <BadgeCheck size={15} />
            {completionLabel}
          </span>
          <button
            className="primary-button"
            disabled={!canExport}
            onClick={exportSignedPdf}
          >
            <Download size={17} />
            Export signed PDF
          </button>
          <button
            className="secondary-button"
            disabled={!signedPdfBytes}
            onClick={downloadSignedPdf}
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="workflow-rail" aria-label="Signing workflow">
          {workflowSteps.map(({ label, Icon, done }) => (
            <div
              className={`rail-step ${done ? "done" : ""}`}
              key={label}
            >
              <div className="rail-icon">
                <Icon size={18} />
              </div>
              <span>{label}</span>
            </div>
          ))}
        </aside>

        <section className="document-panel" aria-label="Document workspace">
          <div className="document-toolbar">
            <div>
              <span className="section-label">Document preview</span>
              <strong>{documentName || "Waiting for PDF"}</strong>
            </div>
            <div className="toolbar-actions">
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
              />
              <button
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                Upload PDF
              </button>
              <button className="secondary-button" onClick={loadSample}>
                <FileText size={16} />
                Load sample
              </button>
            </div>
          </div>

          <div className="preview-shell">
            {documentBytes ? (
              <div
                ref={previewStageRef}
                className="page-stage"
                onPointerMove={updateFieldFromPointer}
                style={
                  pageMetrics
                    ? {
                        aspectRatio: `${pageMetrics.previewWidth} / ${pageMetrics.previewHeight}`,
                      }
                    : undefined
                }
              >
                <canvas ref={previewCanvasRef} className="pdf-canvas" />
                {fields.map((field) => (
                  <div
                    className={`field-box field-${field.type} ${
                      activeFieldId === field.id ? "selected" : ""
                    } ${draggedFieldId === field.id ? "dragging" : ""}`}
                    key={field.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${field.label} field`}
                    onFocus={() => setActiveFieldId(field.id)}
                    onPointerDown={(event) => startFieldDrag(field, event)}
                    onPointerUp={stopFieldDrag}
                    onPointerCancel={stopFieldDrag}
                    style={{
                      left: `${field.placement.x * 100}%`,
                      top: `${field.placement.y * 100}%`,
                      width: `${field.placement.width * 100}%`,
                      height: `${field.placement.height * 100}%`,
                    }}
                  >
                    <small>{field.label}</small>
                    {renderFieldPreview(field)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-document">
                <FileText size={42} />
                <h2>Start with a PDF</h2>
                <p>
                  Upload a waiver or load the sample document to test the local
                  signing flow.
                </p>
                <div className="empty-actions">
                  <button
                    className="primary-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={17} />
                    Upload PDF
                  </button>
                  <button className="secondary-button" onClick={loadSample}>
                    <FileText size={16} />
                    Load sample
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="inspector" aria-label="Signing controls">
          <section className="inspector-section">
            <div className="section-heading">
              <Fingerprint size={18} />
              <h2>Signer</h2>
            </div>
            <label className="field-label" htmlFor="signer-name">
              Legal name
            </label>
            <input
              id="signer-name"
              value={signerName}
              onChange={(event) => {
                setSignerName(event.target.value);
                clearEvidence();
              }}
              placeholder="Your name"
            />
          </section>

          <section className="inspector-section">
            <div className="section-heading">
              <PenLine size={18} />
              <h2>Signature</h2>
            </div>
            <div className="segmented-control" aria-label="Signature mode">
              <button
                className={signatureMode === "draw" ? "active" : ""}
                onClick={() => {
                  setSignatureMode("draw");
                  clearEvidence();
                }}
              >
                Draw
              </button>
              <button
                className={signatureMode === "type" ? "active" : ""}
                onClick={() => {
                  setSignatureMode("type");
                  clearEvidence();
                }}
              >
                Type
              </button>
            </div>

            {signatureMode === "draw" ? (
              <div className="signature-pad-wrap">
                <canvas
                  ref={signatureCanvasRef}
                  className="signature-pad"
                  width={720}
                  height={220}
                  onPointerDown={startSignature}
                  onPointerMove={drawSignature}
                  onPointerUp={stopSignature}
                  onPointerCancel={stopSignature}
                />
                <button className="icon-button" onClick={clearSignature}>
                  <RotateCcw size={15} />
                  Clear
                </button>
              </div>
            ) : (
              <label className="typed-signature">
                <span>Typed signature</span>
                <input
                  value={typedSignature}
                  onChange={(event) => {
                    setTypedSignature(event.target.value);
                    clearEvidence();
                  }}
                  placeholder="Type your signature"
                />
              </label>
            )}
          </section>

          <section className="inspector-section">
            <div className="section-heading">
              <FileCheck2 size={18} />
              <h2>Fields</h2>
            </div>
            <div className="field-add-grid">
              <button
                className="secondary-button"
                aria-label="Add signature field"
                onClick={() => addField("signature")}
              >
                <PenLine size={15} />
                Signature
              </button>
              <button
                className="secondary-button"
                aria-label="Add date field"
                onClick={() => addField("date")}
              >
                <Calendar size={15} />
                Date
              </button>
              <button
                className="secondary-button"
                aria-label="Add printed name field"
                onClick={() => addField("printedName")}
              >
                <Fingerprint size={15} />
                Printed name
              </button>
              <button
                className="secondary-button"
                aria-label="Add text field"
                onClick={() => addField("text")}
              >
                <Type size={15} />
                Text
              </button>
            </div>

            {fields.length ? (
              <div className="field-list">
                {fields.map((field) => (
                  <button
                    className={activeFieldId === field.id ? "active" : ""}
                    key={field.id}
                    aria-label={`Select ${field.label} field`}
                    onClick={() => setActiveFieldId(field.id)}
                  >
                    <span>{field.label}</span>
                    <small>{fieldLabels[field.type]}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-fields">No fields placed</div>
            )}

            {activeField ? (
              <div className="field-editor">
                <label className="field-label" htmlFor="field-label">
                  Selected label
                </label>
                <input
                  id="field-label"
                  value={activeField.label}
                  onChange={(event) =>
                    updateField(activeField.id, { label: event.target.value })
                  }
                />

                {activeField.type === "text" ? (
                  <>
                    <label className="field-label" htmlFor="field-value">
                      Text value
                    </label>
                    <input
                      id="field-value"
                      value={activeField.value ?? ""}
                      onChange={(event) =>
                        updateField(activeField.id, { value: event.target.value })
                      }
                    />
                  </>
                ) : null}

                <button className="secondary-button danger full" onClick={removeActiveField}>
                  <Trash2 size={15} />
                  Remove selected
                </button>
              </div>
            ) : null}
          </section>

          <section className="inspector-section evidence">
            <div className="section-heading">
              <Hash size={18} />
              <h2>Evidence bundle</h2>
            </div>
            <dl>
              <div>
                <dt>Original SHA-256</dt>
                <dd>{shortHash(originalHash)}</dd>
              </div>
              <div>
                <dt>Signed SHA-256</dt>
                <dd>{shortHash(signedHash)}</dd>
              </div>
              <div>
                <dt>Timestamp</dt>
                <dd>{certificate?.signedAt ?? "created on export"}</dd>
              </div>
              <div>
                <dt>Fields</dt>
                <dd>{certificate?.fields.length ?? fields.length}</dd>
              </div>
            </dl>
            <button
              className="secondary-button full"
              disabled={!certificate}
              onClick={downloadCertificate}
            >
              <Download size={16} />
              Download certificate JSON
            </button>
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <span>{statusMessage}</span>
        {errorMessage ? <strong>{errorMessage}</strong> : null}
        <span className="statusbar-note">
          Local-only prototype. No upload, no identity proofing.
        </span>
      </footer>
    </main>
  );
}
