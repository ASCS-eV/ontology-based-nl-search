/** Extract SPARQL query from LLM response (handles markdown code blocks) */
export function extractSparql(text: string): string {
  // Try to find SPARQL in a code block
  const codeBlockMatch = text.match(/```(?:sparql)?\s*\n?([\s\S]*?)```/)
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim()
  }

  // If no code block, assume the entire response is SPARQL
  return text.trim()
}
