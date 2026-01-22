# Performance Guide

Sand.js is designed to handle typical sunburst visualization use cases efficiently. This guide covers performance characteristics and optimization recommendations.

## Performance Summary

| Operation | 100 nodes | 1,000 nodes | 5,000 nodes | 10,000 nodes |
|-----------|-----------|-------------|-------------|--------------|
| Layout computation | <0.1ms | ~0.3ms | ~1.5ms | ~3ms |
| Initial render | ~1ms | ~8ms | ~40ms | ~80ms |
| Update render | ~2ms | ~7ms | ~48ms | ~100ms |
| Navigation (drill-down) | ~1ms | ~8ms | ~50ms | - |

*Benchmarks run on Node.js with DOM stubs. Real browser performance may be better due to native SVG optimizations.*

## Recommended Node Limits

### For 60fps Interactive Charts
- **Recommended**: Up to 1,000 nodes for smooth animations
- **Acceptable**: Up to 5,000 nodes (may have frame drops during transitions)
- **Large displays**: Up to 10,000 nodes for static or rarely updated charts

### For Static or Rarely Updated Charts
- Up to 50,000 nodes can be rendered, but initial load time increases significantly

## Optimization Tips

### 1. Use Collapsed Nodes for Large Datasets

If your dataset has deeply nested hierarchies, use `collapsed: true` to hide descendants until the user drills down:

```javascript
const tree = {
  name: 'Root',
  children: [
    {
      name: 'Large Branch',
      collapsed: true,  // Children hidden until clicked
      children: [/* thousands of nodes */]
    }
  ]
};
```

### 2. Limit Expand Levels

Control how many levels are rendered at once using `expandLevels`:

```javascript
const config = {
  size: { radius: 300 },
  layers: [{
    id: 'main',
    radialUnits: [0, 5],
    angleMode: 'free',
    tree: {
      name: 'Root',
      expandLevels: 3,  // Only show 3 levels deep
      children: [/* deep hierarchy */]
    }
  }]
};
```

### 3. Disable Transitions for Large Datasets

Animations add overhead. For large datasets, disable transitions:

```javascript
renderSVG({
  el: container,
  config,
  transition: false  // No animations
});
```

### 4. Use Navigation for Drill-Down

Instead of rendering the entire dataset, use the navigation feature to let users drill down:

```javascript
renderSVG({
  el: container,
  config,
  navigation: true,
  breadcrumbs: true
});
```

### 5. Consider Data Aggregation

For very large datasets, pre-aggregate data on the server:

```javascript
// Instead of 100,000 individual items
const rawData = { /* 100k nodes */ };

// Aggregate to ~1,000 meaningful groups
const aggregatedData = aggregateByCategory(rawData);
```

## Layout Complexity

The layout algorithm has approximately **O(n)** complexity where n is the number of visible nodes. Performance scales linearly with node count.

### Tree Shape Impact

| Shape | Performance | Use Case |
|-------|-------------|----------|
| Wide (many siblings) | Fastest | Flat hierarchies |
| Balanced | Typical | Most use cases |
| Deep (many levels) | Slightly slower | Deep nesting |

## Feature Overhead

Enabling optional features adds minimal overhead:

| Feature | Overhead |
|---------|----------|
| Tooltip | ~2% |
| Navigation | ~5% |
| Highlight by key | ~2% |
| All features | ~10% |

## Memory Considerations

Each arc requires:
- SVG path element
- Label elements (text + textPath)
- Event listeners
- Internal tracking data

Approximate memory per arc: ~1-2KB

For 10,000 nodes: ~10-20MB of DOM and JavaScript memory

## Running Benchmarks

Run the benchmark suite to test performance on your system:

```bash
# Run all benchmarks
npm run bench

# Run specific benchmarks
npm run bench:layout
npm run bench:render
npm run bench:navigation
```

## Browser Considerations

- **Chrome/Edge**: Best SVG rendering performance
- **Firefox**: Good performance, slightly slower for large SVG updates
- **Safari**: Good performance, hardware-accelerated
- **Mobile**: Reduce node count by ~50% for smooth interactions

## Summary

For most use cases with 100-5,000 nodes, Sand.js performs well without optimization. For larger datasets:

1. Use collapsed nodes and navigation
2. Limit expand levels
3. Consider disabling transitions
4. Aggregate data when possible
