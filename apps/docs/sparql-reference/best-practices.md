# SPARQL Best Practices

## Prefer explicit term handling

RDF values are not all plain strings. A variable may hold:

- an IRI
- a literal
- a blank node

If you need string matching, normalize first:

```sparql
FILTER(CONTAINS(LCASE(STR(?value)), "fr"))
```

## Be deliberate about IRI vs literal comparisons

Use term comparison when you mean RDF identity:

```sparql
FILTER(?country = <http://example.org/country/FR>)
```

Use `STR()` when you mean textual comparison:

```sparql
FILTER(CONTAINS(STR(?country), "FR"))
```

## Remember case sensitivity

Many SPARQL string operations are case-sensitive.

```sparql
FILTER(CONTAINS(?label, "Road"))
```

For case-insensitive matching, normalize both sides:

```sparql
FILTER(CONTAINS(LCASE(STR(?label)), "road"))
```

## Understand unbound values

Variables inside `OPTIONAL` may be unbound.

```sparql
OPTIONAL { ?item <http://example.org/comment> ?comment }
FILTER(!BOUND(?comment))
```

Unbound is not the same as an empty string.

## Avoid accidental cartesian products

Every extra graph pattern can multiply solutions. Join patterns carefully and use `DISTINCT` only when deduplication is actually needed.

## Keep FILTER expressions simple

Prefer a few focused expressions over one large nested expression. This makes parsing, debugging, and validation easier.

## Use property paths intentionally

Property paths are powerful but can be expensive. Prefer the narrowest path that matches the requirement.

## Validate prefixes early

Unknown or misspelled prefixes cause parse failures. Declare all prefixes once near the top of the query.

## Prefer typed comparisons for numeric and date values

When a value is numeric or temporal, compare it as such rather than as text.

```sparql
FILTER(?count >= 10)
FILTER(?createdAt >= "2025-01-01T00:00:00Z"^^xsd:dateTime)
```

## Test with representative term shapes

If data may contain both literals and IRIs, test both cases. String functions should usually operate on `STR(...)` output, not on the raw RDF term.
