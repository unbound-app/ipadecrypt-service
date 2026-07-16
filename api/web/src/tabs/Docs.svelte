<script lang="ts">
  import CopyButton from '../components/CopyButton.svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import { sessionState } from '../lib/session.svelte';

  const base = $derived(sessionState.publicBaseUrl ?? location.origin);

  const usingApiKeyCmd = $derived(
    `curl -H "Authorization: Bearer <YOUR_API_KEY>" \\\n  "${base}/v1/decrypt?bundleId=com.hammerandchisel.discord" \\\n  -o discord.ipa`,
  );
  const jobStatusCmd = $derived(`curl -H "Authorization: Bearer <YOUR_API_KEY>" \\\n  "${base}/v1/jobs/<JOB_ID>"`);
  const downloadCmd = $derived(`curl -H "Authorization: Bearer <YOUR_API_KEY>" \\\n  "${base}/v1/jobs/<JOB_ID>/file" \\\n  -o discord.ipa`);
  const specificVersionCmd = $derived(
    `curl -H "Authorization: Bearer <YOUR_API_KEY>" \\\n  "${base}/v1/decrypt?bundleId=com.hammerandchisel.discord&externalVersionId=<EXTERNAL_VERSION_ID>" \\\n  -o discord.ipa`,
  );
</script>

<div class="flex flex-col gap-4">
  <Card title="Using an API key">
    {#snippet headerExtra()}
      <CopyButton text={usingApiKeyCmd} />
    {/snippet}
    <div class="mb-2.5 text-sm text-muted">
      Every request needs <code>Authorization: Bearer &lt;key&gt;</code> - get a key from the API Keys tab first.
    </div>
    <pre class="border-border overflow-x-auto rounded-md border bg-panel-muted p-3 text-[12.5px] leading-relaxed">curl -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  "{base}/v1/decrypt?bundleId=com.hammerandchisel.discord" \
  -o discord.ipa</pre>
  </Card>

  <Card title="Check job status">
    {#snippet headerExtra()}
      <CopyButton text={jobStatusCmd} />
    {/snippet}
    <div class="mb-2.5 text-sm text-muted">
      If a decrypt is still running when the request above times out, it responds with a job id instead of the file.
    </div>
    <pre class="border-border overflow-x-auto rounded-md border bg-panel-muted p-3 text-[12.5px] leading-relaxed">curl -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  "{base}/v1/jobs/&lt;JOB_ID&gt;"</pre>
  </Card>

  <Card title="Download once ready">
    {#snippet headerExtra()}
      <CopyButton text={downloadCmd} />
    {/snippet}
    <pre class="border-border overflow-x-auto rounded-md border bg-panel-muted p-3 text-[12.5px] leading-relaxed">curl -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  "{base}/v1/jobs/&lt;JOB_ID&gt;/file" \
  -o discord.ipa</pre>
  </Card>

  <Card title="Decrypt a specific version">
    {#snippet headerExtra()}
      <CopyButton text={specificVersionCmd} />
    {/snippet}
    <div class="mb-2.5 text-sm text-muted">
      Add <code>externalVersionId</code> to pin to a historical App Store release instead of the current one - get the
      id from the clock-icon button next to a search result on the Home tab.
    </div>
    <pre class="border-border overflow-x-auto rounded-md border bg-panel-muted p-3 text-[12.5px] leading-relaxed">curl -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \
  "{base}/v1/decrypt?bundleId=com.hammerandchisel.discord&externalVersionId=&lt;EXTERNAL_VERSION_ID&gt;" \
  -o discord.ipa</pre>
  </Card>
</div>
