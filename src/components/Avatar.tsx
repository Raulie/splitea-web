import type { JSX } from "solid-js";
import { initialsFor } from "../lib/format";

/// Circular avatar with photo if available, otherwise a
/// gray-bg fallback with the contact's initials. Mirrors the
/// iOS `ContactAvatar` chrome (rounded, subtle border in
/// dark mode, two-letter init fallback).
export interface AvatarProps {
  size: number;
  fullName?: string | null;
  /// Optional source (URL or data: URI). Web doesn't have
  /// access to iOS contact-card photos directly — we'd source
  /// these from a future avatar-upload flow if/when added.
  imageURL?: string | null;
  /// Override for the everyone-assigned indicator. Renders the
  /// people.fill SF Symbol shape on iOS; here we use the same
  /// glyph as an inline SVG.
  variant?: "everyone";
  class?: string;
  style?: JSX.CSSProperties;
}

export function Avatar(props: AvatarProps) {
  const dim = `${props.size}px`;
  const fontSize = `${Math.round(props.size * 0.4)}px`;
  return (
    <div
      class={`shrink-0 rounded-full bg-ios-card-hi flex items-center justify-center overflow-hidden text-ios-label-secondary font-semibold ${props.class ?? ""}`}
      style={{ width: dim, height: dim, "font-size": fontSize, ...props.style }}
    >
      {props.variant === "everyone" ? (
        <EveryoneGlyph size={Math.round(props.size * 0.5)} />
      ) : props.imageURL ? (
        <img
          src={props.imageURL}
          alt={props.fullName ?? ""}
          width={props.size}
          height={props.size}
          class="block w-full h-full object-cover"
        />
      ) : (
        <span>{initialsFor(props.fullName)}</span>
      )}
    </div>
  );
}

/// Approximation of SF Symbol `person.2.fill` used when an
/// item is assigned to everyone. Shipped as inline SVG so we
/// don't depend on Apple's symbol set on non-Apple platforms.
function EveryoneGlyph(props: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={props.size}
      height={props.size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM2 19.25C2 16.34 5.13 14 9 14s7 2.34 7 5.25V21H2v-1.75ZM18.5 21H22v-1.5c0-2.49-2.69-4.5-5.83-4.5-.74 0-1.45.11-2.1.31C16.4 16.4 17.75 17.94 18 19.5l.5 1.5Z" />
    </svg>
  );
}
