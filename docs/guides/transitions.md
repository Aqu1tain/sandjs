# Transitions & Animations

[← Back to Documentation](../README.md)

Smooth animations when updating charts or navigating.

## Quick Start

```javascript
renderSVG({
  el: '#chart',
  config,
  transition: true  // Enable with defaults
});
```

## Configuration

```typescript
interface TransitionOptions {
  duration?: number;
  easing?: (t: number) => number;
  delay?: number;
}
```

### Options

**duration**: Animation length in milliseconds (default: 500)

```javascript
transition: {
  duration: 800  // Slower animation
}
```

**easing**: Easing function (default: cubic ease-in-out)

```javascript
transition: {
  easing: (t) => t * t  // Quadratic ease-in
}
```

**delay**: Delay before animation starts in milliseconds (default: 0)

```javascript
transition: {
  delay: 100
}
```

## Easing Functions

### Built-in Patterns

```javascript
// Linear
easing: (t) => t

// Ease-in (accelerate)
easing: (t) => t * t

// Ease-out (decelerate)
easing: (t) => 1 - Math.pow(1 - t, 2)

// Ease-in-out (smooth, default)
easing: (t) => t < 0.5
  ? 4 * t * t * t
  : 1 - Math.pow(-2 * t + 2, 3) / 2

// Elastic
easing: (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 || t === 1
    ? t
    : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}

// Bounce
easing: (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}
```

## Updating with Transitions

```javascript
const chart = renderSVG({
  el: '#chart',
  config: initialConfig,
  transition: true
});

// Later, update with animation
chart.update({
  config: newConfig,
  transition: {
    duration: 600
  }
});
```

## Navigation Transitions

Separate transition for navigation:

```javascript
renderSVG({
  el: '#chart',
  config,
  transition: true,  // General transitions
  navigation: {
    focusTransition: {
      duration: 700,
      easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    }
  }
});
```

## What Gets Animated

- **Arc geometry**: Position, size, angles
- **Colors**: Fill color changes
- **Appearance/Disappearance**: Fade in/out
- **Layout changes**: Restructuring

## Performance Tips

1. **Shorter durations**: 300-500ms is usually sufficient
2. **Simpler easing**: Complex easing functions can impact performance
3. **Reduce updates**: Batch configuration changes when possible
4. **Consider data size**: Large datasets may need longer transitions

## Best Practices

- **Always use transitions with navigation** for better UX
- **Match duration to update complexity**: Small changes = short duration
- **Test on target devices**: Ensure smooth performance
- **Provide visual feedback**: Transitions indicate change

---

[← Back to Documentation](../README.md) | [Next: Labels →](./labels.md)
