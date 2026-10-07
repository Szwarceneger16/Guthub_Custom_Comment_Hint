const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['github-token', /\b(?:github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,})\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['service-token', /\b(?:xox[baprs]-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{30,})\b/],
  ['local-machine-path', /\/(?:home|Users|tmp|run\/user)\/[^\s"'<>]+|[A-Za-z]:\\Users\\[^\s"'<>]+/],
  ['credential-url', /https?:\/\/[^\s/"']+:[^\s/@"']+@/],
  ['private-repository-reference', /https?:\/\/github\.com\/[^\s/"']+\/[^\s/"']*private[^\s/"']*|"(?!private")[^"\n]*private[^"\n]*"\s*:/i],
  ['conversation-identifier', /codex-clipboard-[0-9a-f-]{36}\.png|(?:thread_id|plan_log_row_id)\s*["']?\s*[:=]\s*["']?[0-9a-f-]{8,}/i],
  ['literal-secret', /\b(?:api[_-]?key|api[_-]?secret|password|WEB_EXT_API_KEY|WEB_EXT_API_SECRET)["']?\s*[:=]\s*["']?(?!local-preflight-|\$\{|<)[A-Za-z0-9_+\/-]{16,}["']?/i],
];

export function prohibitedPath(name) {
  return /(?:^|\/)(?:RECOVERY(?:_PROVENANCE)?\.(?:md|json)|RECOVERED_[^/]+|AGENT_HANDOFF\.md|\.codex|\.memory|memory)(?:$|\/)/i.test(name);
}

export function privacyFindings(bytes) {
  const buffer = Buffer.from(bytes);
  const findings = [];
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    for (let offset = 8; offset + 12 <= buffer.length;) {
      const size = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(type)) findings.push('image-metadata');
      offset += size + 12;
    }
  }
  // Scan every byte, including image chunks and data after PNG's IEND.
  const text = buffer.toString('utf8');
  findings.push(...rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name));
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  if (emails.some(email => !/@users\.noreply\.github\.com$/i.test(email) &&
    !/@(?:example\.(?:com|org|net)|[^@]+\.(?:invalid|example|test))$/i.test(email))) findings.push('contact-email');
  return [...new Set(findings)];
}
