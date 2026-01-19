/**
 * SVG and XLINK namespaces
 */
export const SVG_NS = 'http://www.w3.org/2000/svg';
export const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * Label rendering thresholds (in pixels)
 */
export const LABEL_MIN_RADIAL_THICKNESS = 14; // Minimum arc thickness to show labels
export const LABEL_MIN_FONT_SIZE = 12; // Minimum readable font size
export const LABEL_MAX_FONT_SIZE = 18; // Maximum font size for labels
export const LABEL_CHAR_WIDTH_FACTOR = 0.7; // Average character width as fraction of font size
export const LABEL_PADDING = 8; // Padding around label text (pixels)
export const LABEL_SAFETY_MARGIN = 1.15; // 15% safety margin for label fitting calculations
export const LABEL_TANGENT_SAMPLE_RATIO = 0.01; // Proportion of arc span for tangent sampling
export const LABEL_TANGENT_MIN_DELTA = 1e-4; // Minimum delta to avoid numerical instability
export const LABEL_TANGENT_MAX_DELTA = 0.1; // Maximum delta to keep sampling local

/**
 * Collapsed arc visual indicators
 */
export const COLLAPSED_ARC_SPAN_SHRINK_FACTOR = 0.1; // Shrink span to 10% of original
export const COLLAPSED_ARC_MIN_SPAN = 0.01; // Minimum span in radians for collapsed arcs
export const COLLAPSED_ARC_THICKNESS_SHRINK_FACTOR = 0.1; // Shrink thickness to 10% of original
export const COLLAPSED_ARC_MIN_THICKNESS = 0.5; // Minimum thickness in pixels for collapsed arcs
