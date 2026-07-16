/**
 * ui-kit.js — shared presentational primitives for the WEB app (desktop-first).
 * Web-only; the mobile app has its own component set and is untouched.
 * Gives every page a consistent, professional layout: containers, headers,
 * cards, KPI tiles, section panels, filters, avatars and empty/loading states.
 */
import React from "react";
import { colors } from "@/theme/colors";

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

/* Page container: caps width on large screens, comfortable desktop padding.
   pb is generous on mobile (bottom nav) and tighter on desktop. */
export function Page({ children, className = "", width = "default", testId }) {
  const max = width === "narrow" ? "max-w-[860px]" : width === "wide" ? "max-w-[1600px]" : "max-w-[1440px]";
  return (
    <div
      data-testid={testId}
      className={`${max} mx-auto w-full px-5 md:px-8 lg:px-10 pt-6 md:pt-9 pb-24 md:pb-12 animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
}

/* Elegant page header: gold overline, serif display title, subtitle, right actions. */
export function PageHeader({ overline, title, subtitle, actions, icon, testId }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6 md:mb-8">
      <div className="min-w-0">
        {overline && (
          <p
            className="text-[10.5px] tracking-[3px] font-bold uppercase mb-2"
            style={{ color: colors.brand.gold }}
          >
            {overline}
          </p>
        )}
        <div className="flex items-center gap-3">
          {icon && (
            <span
              className="hidden md:flex w-10 h-10 rounded-xl items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(123,24,30,0.06)", color: colors.brand.maroon }}
            >
              {icon}
            </span>
          )}
          <h1
            className="font-display text-[26px] md:text-[34px] font-bold leading-none"
            style={{ color: colors.brand.maroon }}
            data-testid={testId}
          >
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-[13.5px] mt-2 max-w-2xl" style={{ color: colors.text.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </header>
  );
}

/* White elevated surface. Pass onClick/hover to make it interactive. */
export function Card({ children, className = "", hover = false, onClick, style, testId, as }) {
  const Comp = as || (onClick ? "button" : "div");
  return (
    <Comp
      data-testid={testId}
      onClick={onClick}
      className={`rounded-2xl border shadow-card ${
        hover || onClick ? "transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5" : ""
      } ${onClick ? "text-left w-full focus:outline-none focus:ring-2 focus:ring-[#D4AF37]" : ""} ${className}`}
      style={{ backgroundColor: colors.bg.card, borderColor: colors.border.subtle, ...style }}
    >
      {children}
    </Comp>
  );
}

/* KPI tile: icon chip, big number, label, optional hint. Accent-tinted. */
export function StatTile({ label, value, icon, accent = colors.brand.maroon, hint, onClick, testId }) {
  return (
    <Card
      testId={testId}
      onClick={onClick}
      className="p-4 lg:p-5 flex flex-col gap-3 relative overflow-hidden"
    >
      <span className="absolute top-0 left-0 h-full w-1" style={{ backgroundColor: accent }} />
      <div className="flex items-center justify-between">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          {icon}
        </span>
        {hint != null && (
          <span className="text-[11px] font-semibold" style={{ color: colors.text.muted }}>
            {hint}
          </span>
        )}
      </div>
      <div>
        <div className="font-display text-[30px] leading-none font-bold" style={{ color: colors.text.primary }}>
          {value}
        </div>
        <div className="text-[11px] tracking-[0.6px] font-bold uppercase mt-1.5" style={{ color: colors.text.muted }}>
          {label}
        </div>
      </div>
    </Card>
  );
}

/* Titled white panel with optional right-side action. */
export function SectionCard({ title, action, children, className = "", bodyClassName = "", testId }) {
  return (
    <Card className={`overflow-hidden ${className}`} testId={testId}>
      {(title || action) && (
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: colors.border.subtle }}
        >
          <h2 className="font-display text-[16px] font-bold" style={{ color: colors.brand.maroon }}>
            {title}
          </h2>
          {action}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </Card>
  );
}

/* Segmented filter chips row (horizontal-scroll on mobile). */
export function FilterChips({ items, value, onChange, testIdPrefix = "filter-chip" }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
      {items.map((f) => {
        const active = value === f.key;
        return (
          <button
            key={f.key}
            data-testid={`${testIdPrefix}-${f.key}`}
            onClick={() => onChange(f.key)}
            className="shrink-0 h-9 px-4 rounded-full text-[12.5px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            style={{
              backgroundColor: active ? colors.brand.maroon : colors.bg.card,
              borderColor: active ? colors.brand.maroon : colors.border.subtle,
              color: active ? colors.text.inverse : colors.text.secondary,
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/* Initials avatar; color keyed by role. */
export function Avatar({ name, role, size = 40, className = "" }) {
  const bg = role === "manager" ? colors.brand.navy : role === "admin" ? colors.brand.maroonDeep : colors.brand.maroon;
  return (
    <span
      className={`rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: colors.text.inverse,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(name)}
    </span>
  );
}

/* Small round icon button. */
export function IconButton({ icon, onClick, label, variant = "solid", size = 40, testId, className = "" }) {
  const styles =
    variant === "solid"
      ? { backgroundColor: colors.brand.maroon, color: colors.text.inverse }
      : { backgroundColor: colors.bg.card, color: colors.brand.maroon, border: `1px solid ${colors.border.medium}` };
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-full flex items-center justify-center transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] ${className}`}
      style={{ width: size, height: size, ...styles }}
    >
      {icon}
    </button>
  );
}

/* Primary / secondary pill button with icon. */
export function Button({ children, icon, onClick, variant = "primary", type = "button", testId, className = "" }) {
  const styles =
    variant === "primary"
      ? { backgroundColor: colors.brand.maroon, color: colors.text.inverse, border: `1px solid ${colors.brand.maroon}` }
      : variant === "gold"
      ? { backgroundColor: "rgba(212,175,55,0.14)", color: colors.brand.goldDeep, border: `1px solid ${colors.brand.gold}` }
      : { backgroundColor: colors.bg.card, color: colors.brand.maroon, border: `1px solid ${colors.border.medium}` };
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-[13.5px] font-bold transition-all hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-[#D4AF37] ${className}`}
      style={styles}
    >
      {icon}
      {children}
    </button>
  );
}

export function Spinner({ className = "py-16" }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <span
        className="animate-spin w-8 h-8 border-[3px] rounded-full"
        style={{ borderColor: colors.brand.maroon, borderTopColor: "transparent" }}
      />
    </div>
  );
}

export function EmptyState({ icon, title, message, action, testId }) {
  return (
    <Card className="flex flex-col items-center text-center py-16 px-8" testId={testId}>
      <span
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(212,175,55,0.12)", color: colors.brand.gold }}
      >
        {icon}
      </span>
      <p className="font-display text-xl font-bold" style={{ color: colors.brand.maroon }}>
        {title}
      </p>
      {message && (
        <p className="text-[13.5px] mt-1.5 max-w-sm" style={{ color: colors.text.secondary }}>
          {message}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}
