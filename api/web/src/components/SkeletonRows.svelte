<script lang="ts">
  let { rows = 3, colspan = 4 }: { rows?: number; colspan?: number } = $props();
</script>

{#each Array(rows) as _, i (i)}
  <tr>
    <td {colspan}><div class="skeleton-row"></div></td>
  </tr>
{/each}
