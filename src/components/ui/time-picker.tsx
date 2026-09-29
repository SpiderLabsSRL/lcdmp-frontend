import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { Clock, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}

type Step = "hour" | "minute";
type Mode = "dial" | "keyboard";

const HOUR_OUTER_RADIUS = 40;
const HOUR_INNER_RADIUS = 25;
const MINUTE_RADIUS = 40;

const parseValue = (value: string): [number, number] => {
  const [h, m] = (value || "00:00").split(":").map((n) => parseInt(n, 10));
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
};

const formatValue = (hour: number, minute: number) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

const dialPosition = (index: number, radiusPercent: number) => {
  const angle = ((index * 30 - 90) * Math.PI) / 180;
  return {
    x: 50 + radiusPercent * Math.cos(angle),
    y: 50 + radiusPercent * Math.sin(angle),
  };
};

const outerHourValue = (index: number) => (index === 0 ? 12 : index);
const innerHourValue = (index: number) => (index === 0 ? 0 : index + 12);
const minuteValue = (index: number) => index * 5;

const hourRingIndex = (h: number) => (h === 12 || h === 0 ? 0 : h > 12 ? h - 12 : h);
const hourRingRadius = (h: number) => (h === 0 || h >= 13 ? HOUR_INNER_RADIUS : HOUR_OUTER_RADIUS);

interface DialNumber {
  value: number;
  label: string;
  x: number;
  y: number;
  outer: boolean;
}

const buildHourNumbers = (): DialNumber[] => {
  const numbers: DialNumber[] = [];
  for (let i = 0; i < 12; i++) {
    const outer = dialPosition(i, HOUR_OUTER_RADIUS);
    numbers.push({ value: outerHourValue(i), label: String(outerHourValue(i)), x: outer.x, y: outer.y, outer: true });
    const inner = dialPosition(i, HOUR_INNER_RADIUS);
    numbers.push({ value: innerHourValue(i), label: String(innerHourValue(i)).padStart(2, "0"), x: inner.x, y: inner.y, outer: false });
  }
  return numbers;
};

const buildMinuteNumbers = (): DialNumber[] => {
  const numbers: DialNumber[] = [];
  for (let i = 0; i < 12; i++) {
    const { x, y } = dialPosition(i, MINUTE_RADIUS);
    numbers.push({ value: minuteValue(i), label: String(minuteValue(i)).padStart(2, "0"), x, y, outer: true });
  }
  return numbers;
};

const HOUR_NUMBERS = buildHourNumbers();
const MINUTE_NUMBERS = buildMinuteNumbers();

export function TimePicker({ value, onChange, className, disabled, id }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("hour");
  const [mode, setMode] = useState<Mode>("dial");
  const [draftHour, setDraftHour] = useState(0);
  const [draftMinute, setDraftMinute] = useState(0);
  const dialRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const openPicker = () => {
    const [h, m] = parseValue(value);
    setDraftHour(h);
    setDraftMinute(m);
    setStep("hour");
    setMode("dial");
    setOpen(true);
  };

  const selectFromPoint = useCallback((clientX: number, clientY: number) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    if (step === "hour") {
      const distPercent = (Math.hypot(dx, dy) / (rect.width / 2)) * 50;
      const idx = Math.round(angle / 30) % 12;
      const isOuter = distPercent > (HOUR_OUTER_RADIUS + HOUR_INNER_RADIUS) / 2;
      setDraftHour(isOuter ? outerHourValue(idx) : innerHourValue(idx));
    } else {
      const minute = Math.round(angle / 6) % 60;
      setDraftMinute(minute);
    }
  }, [step]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    selectFromPoint(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    selectFromPoint(e.clientX, e.clientY);
  };
  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (step === "hour") setStep("minute");
  };

  const selectHour = (h: number) => {
    setDraftHour(h);
    setStep("minute");
  };

  const handleAccept = () => {
    onChange(formatValue(draftHour, draftMinute));
    setOpen(false);
  };

  const numbers = step === "hour" ? HOUR_NUMBERS : MINUTE_NUMBERS;
  const selectedValue = step === "hour" ? draftHour : draftMinute;
  const handPos =
    step === "hour"
      ? dialPosition(hourRingIndex(draftHour), hourRingRadius(draftHour))
      : dialPosition(draftMinute / 5, MINUTE_RADIUS);

  return (
    <>
      <Button
        type="button"
        id={id}
        variant="outline"
        disabled={disabled}
        onClick={openPicker}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base font-normal ring-offset-background hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
      >
        <span>{formatValue(...parseValue(value))}</span>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[300px] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[300px]">
          <DialogTitle className="sr-only">Seleccionar hora</DialogTitle>

          <div data-testid="time-picker-display" className="flex items-center justify-center gap-2 bg-primary px-6 py-5">
            <button
              type="button"
              onClick={() => setStep("hour")}
              className={cn(
                "text-4xl font-semibold tabular-nums transition-opacity",
                step === "hour" ? "text-primary-foreground" : "text-primary-foreground/50",
              )}
            >
              {String(draftHour).padStart(2, "0")}
            </button>
            <span className="text-4xl font-semibold text-primary-foreground/70">:</span>
            <button
              type="button"
              onClick={() => setStep("minute")}
              className={cn(
                "text-4xl font-semibold tabular-nums transition-opacity",
                step === "minute" ? "text-primary-foreground" : "text-primary-foreground/50",
              )}
            >
              {String(draftMinute).padStart(2, "0")}
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 p-6">
            {mode === "dial" ? (
              <div
                ref={dialRef}
                data-testid="time-picker-dial"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerLeave={() => draggingRef.current && endDrag()}
                className="relative h-64 w-64 touch-none select-none rounded-full bg-muted"
              >
                <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
                  <line x1={50} y1={50} x2={handPos.x} y2={handPos.y} stroke="hsl(var(--primary))" strokeWidth={1.5} />
                  <circle cx={50} cy={50} r={2} fill="hsl(var(--primary))" />
                  <circle cx={handPos.x} cy={handPos.y} r={9} fill="hsl(var(--primary))" />
                </svg>

                {numbers.map((n) => (
                  <button
                    key={`${n.outer ? "o" : "i"}-${n.value}`}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => (step === "hour" ? selectHour(n.value) : setDraftMinute(n.value))}
                    style={{ left: `${n.x}%`, top: `${n.y}%` }}
                    className={cn(
                      "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm transition-colors",
                      n.value === selectedValue
                        ? "font-semibold text-primary-foreground"
                        : n.outer
                          ? "text-foreground hover:bg-accent/30"
                          : "text-muted-foreground hover:bg-accent/30",
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 py-6">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={draftHour}
                  onChange={(e) => setDraftHour(Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="h-16 w-20 rounded-md border border-input bg-background text-center text-3xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Hora"
                />
                <span className="text-3xl font-semibold">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={draftMinute}
                  onChange={(e) => setDraftMinute(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="h-16 w-20 rounded-md border border-input bg-background text-center text-3xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Minutos"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 pb-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMode(mode === "dial" ? "keyboard" : "dial")}
              aria-label={mode === "dial" ? "Ingresar hora con teclado" : "Usar reloj"}
            >
              {mode === "dial" ? <Keyboard className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </Button>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="ghost" onClick={handleAccept} className="font-semibold text-primary">
                Aceptar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
