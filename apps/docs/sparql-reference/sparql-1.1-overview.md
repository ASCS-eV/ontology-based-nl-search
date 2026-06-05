# SPARQL 1.1 Overview

SPARQL 1.1 is the W3C query language for RDF graphs. Queries match graph patterns, bind variables, and then shape the result set with modifiers such as `ORDER BY`, `LIMIT`, and `DISTINCT`.

## Core query shape

```sparql
PREFIX ex: <http://example.org/>

SELECT ?subject ?label
WHERE {
  ?subject ex:label ?label .
}
LIMIT 10
```

## Triple patterns and variables

- RDF data is queried as subject-predicate-object triples.
- Variables start with `?` or `$`.
- A solution is produced when all required patterns match.

```sparql
SELECT ?person ?name WHERE {
  ?person <http://xmlns.com/foaf/0.1/name> ?name .
}
```

## FILTER

`FILTER` narrows the solutions produced by graph matching.

```sparql
PREFIX ex: <http://example.org/>

SELECT ?item WHERE {
  ?item ex:score ?score .
  FILTER(?score >= 10)
}
```

## OPTIONAL

`OPTIONAL` keeps the main match even when extra data is missing.

```sparql
PREFIX ex: <http://example.org/>

SELECT ?item ?comment WHERE {
  ?item ex:title ?title .
  OPTIONAL { ?item ex:comment ?comment }
}
```

If the optional pattern does not match, the variables inside it remain unbound.

## UNION

`UNION` matches either branch.

```sparql
PREFIX ex: <http://example.org/>

SELECT ?item WHERE {
  { ?item ex:status "draft" }
  UNION
  { ?item ex:status "published" }
}
```

## Property paths

SPARQL 1.1 property paths let one pattern traverse multiple edges.

| Syntax                   | Meaning      |
| ------------------------ | ------------ |
| `ex:parent/ex:name`      | sequence     |
| `ex:parent\|ex:guardian` | alternative  |
| `^ex:parent`             | inverse path |
| `ex:child*`              | zero or more |
| `ex:child+`              | one or more  |
| `ex:child?`              | zero or one  |

```sparql
PREFIX ex: <http://example.org/>

SELECT ?ancestor WHERE {
  ?start ex:parent+ ?ancestor .
}
```

## Solution modifiers

Common modifiers:

- `DISTINCT`
- `ORDER BY`
- `LIMIT`
- `OFFSET`
- `GROUP BY`
- `HAVING`

```sparql
PREFIX ex: <http://example.org/>

SELECT ?category (COUNT(?item) AS ?count)
WHERE {
  ?item ex:category ?category .
}
GROUP BY ?category
ORDER BY DESC(?count)
```

## Good defaults

- Use `PREFIX` declarations for readability.
- Prefer `OPTIONAL` only when missing data is acceptable.
- Use `STR()` before string functions when a term may be an IRI.
- Keep `FILTER` expressions close to the variables they constrain.

## References

- W3C SPARQL 1.1 Query Language: <https://www.w3.org/TR/sparql11-query/>
- W3C SPARQL 1.1 Overview: <https://www.w3.org/TR/sparql11-overview/>
