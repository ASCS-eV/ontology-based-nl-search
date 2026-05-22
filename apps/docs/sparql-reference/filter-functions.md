# SPARQL FILTER Functions

This page summarizes the standard built-in functions commonly used inside `FILTER`, `BIND`, `ORDER BY`, `HAVING`, and projected expressions.

## String functions

- `STR(term)`
- `LANG(literal)`
- `LANGMATCHES(tag, pattern)`
- `DATATYPE(literal)`
- `BOUND(?var)`
- `IRI(string)` / `URI(string)`
- `BNODE()` / `BNODE(string)`
- `STRDT(string, datatypeIri)`
- `STRLANG(string, langTag)`
- `UUID()` / `STRUUID()`
- `STRLEN(string)`
- `SUBSTR(string, start[, length])`
- `UCASE(string)`
- `LCASE(string)`
- `STRSTARTS(string, prefix)`
- `STRENDS(string, suffix)`
- `CONTAINS(string, substring)`
- `STRBEFORE(string, substring)`
- `STRAFTER(string, substring)`
- `ENCODE_FOR_URI(string)`
- `CONCAT(a, b, ...)`
- `REGEX(text, pattern[, flags])`
- `REPLACE(text, pattern, replacement[, flags])`

## Numeric functions

- `ABS(number)`
- `ROUND(number)`
- `CEIL(number)`
- `FLOOR(number)`
- `RAND()`

## Date/time extraction

- `NOW()`
- `YEAR(dateTime)`
- `MONTH(dateTime)`
- `DAY(dateTime)`
- `HOURS(dateTime)`
- `MINUTES(dateTime)`
- `SECONDS(dateTime)`
- `TIMEZONE(dateTime)`
- `TZ(dateTime)`

## Hash functions

- `MD5(string)`
- `SHA1(string)`
- `SHA256(string)`
- `SHA384(string)`
- `SHA512(string)`

## Term tests

- `isIRI(term)` / `isURI(term)`
- `isBLANK(term)`
- `isLITERAL(term)`
- `isNUMERIC(term)`
- `sameTerm(a, b)`

## Conditional and error-handling functions

- `IF(condition, whenTrue, whenFalse)`
- `COALESCE(a, b, ...)`

## Existence tests

- `EXISTS { ... }`
- `NOT EXISTS { ... }`

## Examples

### String matching

```sparql
FILTER(CONTAINS(LCASE(STR(?label)), "road"))
FILTER(REGEX(STR(?identifier), "^urn:", "i"))
```

### Optional values

```sparql
FILTER(BOUND(?comment))
FILTER(COALESCE(?score, 0) > 5)
```

### Language-aware labels

```sparql
FILTER(LANGMATCHES(LANG(?label), "en"))
```

### Conditional logic

```sparql
BIND(IF(?score >= 90, "high", "normal") AS ?band)
```

## Notes

- `STR()` converts an RDF term to its lexical string form.
- `REGEX` flags are strings such as `"i"`.
- `BOUND` requires a variable, not a literal.
- `sameTerm` compares RDF terms directly, including IRIs.

## Reference

- W3C SPARQL 1.1 Query Language, section 17: <https://www.w3.org/TR/sparql11-query/#funcs>
