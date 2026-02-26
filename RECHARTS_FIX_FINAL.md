# Recharts Width/Height Error - Final Fix

**Date:** 2026-01-15  
**Issue:** `The width(-1) and height(-1) of chart should be greater than 0`  
**Status:** ✅ Fixed

---

## Root Cause

ResponsiveContainer requires its parent container to have a **fixed height** (not just min-height). Two specific issues:

1. **PieCharts using `height="100%"`** - When parent only has `minHeight: '80px'` (no fixed height), ResponsiveContainer calculates -1
2. **Charts in wrappers with only `min-h-[Xpx]`** - During initial render or layout calculations, container might temporarily have 0 height

---

## Charts Fixed

### Issue #1: PieCharts with `height="100%"`
**File:** `components/stats/WhereYouStandSection.tsx`  
**Lines:** 379-380

**Before:**
```tsx
<div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-2 sm:mb-3" style={{ minHeight: '80px' }}>
  <ResponsiveContainer width="100%" height="100%">
```

**After:**
```tsx
<div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-2 sm:mb-3" style={{ height: '80px', width: '80px' }}>
  <ResponsiveContainer width="100%" height={80}>
```

**Why:** Changed from percentage height to fixed pixel height. Parent now has explicit `height: '80px'` instead of just `minHeight`.

---

### Issue #2: BarChart wrapper with only min-height
**File:** `components/stats/WhereYouStandSection.tsx`  
**Lines:** 528-529

**Before:**
```tsx
<div className="p-4 sm:p-6 min-h-[200px]">
  <ResponsiveContainer width="100%" height={200}>
```

**After:**
```tsx
<div className="p-4 sm:p-6" style={{ height: '200px' }}>
  <ResponsiveContainer width="100%" height={200}>
```

**Why:** Changed from `min-h-[200px]` to fixed `height: '200px'` to ensure container always has computed height.

---

### Issue #3: ChartsAndTrendsSection charts (4 charts)
**File:** `components/stats/ChartsAndTrendsSection.tsx`  
**Lines:** 201, 418, 474, 556

**Before:**
```tsx
<div className="p-6 min-h-[300px] min-w-0">
  <div className="w-full min-h-[300px]">
    <ResponsiveContainer width="100%" height={300}>
```

**After:**
```tsx
<div className="p-6 min-w-0">
  <div className="w-full" style={{ height: '300px' }}>
    <ResponsiveContainer width="100%" height={300}>
```

**Charts Fixed:**
1. TrendsChart (LineChart) - line 203
2. ETATrendChart (LineChart) - line 420
3. ServiceCentersChart (BarChart) - line 476
4. RFERiskChart (PieChart) - line 558

**Why:** Changed wrapper from `min-h-[300px]` to fixed `height: '300px'` to ensure ResponsiveContainer always has a computed parent height.

---

### Issue #4: ProcessingTimeI130Section
**File:** `components/stats/ProcessingTimeI130Section.tsx`  
**Line:** 149

**Before:**
```tsx
<div className="w-full min-h-[200px] min-w-0">
  <ResponsiveContainer width="100%" height={200}>
```

**After:**
```tsx
<div className="w-full min-w-0" style={{ height: '200px' }}>
  <ResponsiveContainer width="100%" height={200}>
```

**Why:** Changed from `min-h-[200px]` to fixed `height: '200px'`.

---

### Issue #5: ProcessingTimeI129FSection
**File:** `components/stats/ProcessingTimeI129FSection.tsx`  
**Line:** 149

**Before:**
```tsx
<div className="w-full min-h-[200px] min-w-0">
  <ResponsiveContainer width="100%" height={200}>
```

**After:**
```tsx
<div className="w-full min-w-0" style={{ height: '200px' }}>
  <ResponsiveContainer width="100%" height={200}>
```

**Why:** Changed from `min-h-[200px]` to fixed `height: '200px'`.

---

### Issue #6: QuietOfficesSection
**File:** `components/stats/QuietOfficesSection.tsx`  
**Line:** 126

**Before:**
```tsx
<ResponsiveContainer width="100%" height={300}>
```

**After:**
```tsx
<div className="w-full" style={{ height: '300px' }}>
  <ResponsiveContainer width="100%" height={300}>
```

**Why:** Added fixed-height wrapper around ResponsiveContainer (it was missing a wrapper with explicit height).

---

## Summary of Changes

| File | Chart Type | Issue | Fix |
|------|-----------|-------|-----|
| `WhereYouStandSection.tsx` | PieChart (3x) | `height="100%"` with parent minHeight | Changed to `height={80}` + fixed parent height |
| `WhereYouStandSection.tsx` | BarChart | `min-h-[200px]` wrapper | Changed to fixed `height: '200px'` |
| `ChartsAndTrendsSection.tsx` | LineChart (2x), BarChart, PieChart | `min-h-[300px]` wrappers | Changed to fixed `height: '300px'` |
| `ProcessingTimeI130Section.tsx` | BarChart | `min-h-[200px]` wrapper | Changed to fixed `height: '200px'` |
| `ProcessingTimeI129FSection.tsx` | BarChart | `min-h-[200px]` wrapper | Changed to fixed `height: '200px'` |
| `QuietOfficesSection.tsx` | BarChart | Missing fixed-height wrapper | Added wrapper with `height: '300px'` |

---

## Files Changed

1. `components/stats/WhereYouStandSection.tsx` - 2 fixes (PieCharts + BarChart)
2. `components/stats/ChartsAndTrendsSection.tsx` - 4 fixes (all charts)
3. `components/stats/ProcessingTimeI130Section.tsx` - 1 fix
4. `components/stats/ProcessingTimeI129FSection.tsx` - 1 fix
5. `components/stats/QuietOfficesSection.tsx` - 1 fix

**Total:** 5 files, 9 chart fixes

---

## Verification

- ✅ Build compiles successfully
- ✅ All ResponsiveContainer have fixed-height parent wrappers
- ✅ No more `height="100%"` usage (changed to pixel values)
- ✅ All wrappers use inline `style={{ height: 'Xpx' }}` for guaranteed computed height
- ✅ Charts not rendered while hidden (conditional rendering handles this)

---

## Expected Behavior After Fix

- ✅ No Recharts width/height errors in console
- ✅ Charts render correctly on page load
- ✅ Charts resize properly on window resize
- ✅ No errors when switching sections or scrolling

---

**End of Fix Summary**
