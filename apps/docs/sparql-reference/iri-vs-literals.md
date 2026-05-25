# IRIs vs Literals in SPARQL

A SPARQL variable can bind to different RDF term kinds. The two most common are IRIs and literals.

## Literal comparisons

Literal equality compares lexical value plus datatype/language semantics.

```sparql
FILTER(?code = "FR")
```

This is appropriate when `?code` is actually stored as a literal.

## IRI comparisons

IRIs are compared as RDF terms.

```sparql
FILTER(?country = <http://example.org/country/FR>)
```

Use this when the data model stores a resource, not a text code.

## Why string functions can fail on IRIs

Functions such as `CONTAINS`, `LCASE`, and `REGEX` are string-oriented. If a variable may hold an IRI, convert it first.

```sparql
FILTER(CONTAINS(STR(?country), "FR"))
FILTER(REGEX(STR(?country), "country/FR$"))
FILTER(CONTAINS(LCASE(STR(?label)), "road"))
```

## `STR()` is the safe bridge

`STR(term)` returns a string form for both literals and IRIs.

- literal input: `"FR"` → `"FR"`
- IRI input: `<http://example.org/country/FR>` → `"http://example.org/country/FR"`

That makes `STR()` the standard choice when a query needs textual matching over mixed term kinds.

## When not to use `STR()`

Do not use `STR()` when you need true RDF term identity.

```sparql
# Better for identity
FILTER(?country = <http://example.org/country/FR>)

# Textual fallback only
FILTER(CONTAINS(STR(?country), "FR"))
```

## Practical rules

- Compare IRIs with IRIs when exact identity matters.
- Compare literals with literals when the field is known to be textual.
- Use `STR()` before `CONTAINS`, `REGEX`, `LCASE`, or `UCASE` when term kind may vary.
- Avoid assuming that an object position is always a literal.

## Typical pitfalls

### Pitfall: direct string function on a raw term

```sparql
FILTER(CONTAINS(?country, "FR"))
```

Safer:

```sparql
FILTER(CONTAINS(STR(?country), "FR"))
```

### Pitfall: case-normalizing before string conversion

```sparql
FILTER(CONTAINS(LCASE(?country), "fr"))
```

Safer:

```sparql
FILTER(CONTAINS(LCASE(STR(?country)), "fr"))
```
