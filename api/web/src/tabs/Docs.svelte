<script lang="ts">
  import { sessionState } from '../lib/session.svelte';

  const base = $derived(sessionState.publicBaseUrl ?? location.origin);
</script>

<div class="panel">
  <h2>Using an API key</h2>
  <div class="muted" style="margin-bottom:10px;">
    Every request needs <code>Authorization: Bearer &lt;key&gt;</code> - get a key from the API Keys tab first.
  </div>
  <pre class="code-block">curl -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  "{base}/v1/decrypt?bundleId=com.hammerandchisel.discord" \
  -o discord.ipa</pre>
</div>

<div class="panel">
  <h2>Check job status</h2>
  <div class="muted" style="margin-bottom:10px;">
    If a decrypt is still running when the request above times out, it responds with a job id instead of the file.
  </div>
  <pre class="code-block">curl -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  "{base}/v1/jobs/&lt;JOB_ID&gt;"</pre>
</div>

<div class="panel">
  <h2>Download once ready</h2>
  <pre class="code-block">curl -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  "{base}/v1/jobs/&lt;JOB_ID&gt;/file" \
  -o discord.ipa</pre>
</div>
