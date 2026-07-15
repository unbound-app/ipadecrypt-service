<script lang="ts">
  let { data, width = 140, height = 28 }: { data: number[]; width?: number; height?: number } = $props();

  const max = $derived(Math.max(1, ...data));
  const barWidth = $derived(width / Math.max(1, data.length));
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
  {#each data as v, i (i)}
    {@const h = Math.max(1.5, (v / max) * height)}
    <rect x={i * barWidth + 0.5} y={height - h} width={Math.max(1, barWidth - 1)} height={h} rx="1" class="fill-accent" opacity={v === 0 ? 0.2 : 1} />
  {/each}
</svg>
