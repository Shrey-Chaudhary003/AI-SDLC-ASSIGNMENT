# Data Model: Smart Todo CLI

## Task

One user-managed task persisted in the task collection.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | Yes | Produced by `deps.idFactory`; nonempty and unique in the collection |
| `title` | string | Yes | Trim both ends; preserve internal whitespace; 1-100 Unicode code points |
| `description` | string | No | Omitted when absent; empty add stores `""`; empty update removes the field |
| `priority` | string enum | Yes | `low`, `medium`, or `high`; defaults to `medium` |
| `tags` | string array | Yes | Defaults to `[]`; trimmed, lowercased, unique, first-occurrence order |
| `status` | string enum | Yes | `todo`, `in_progress`, or `done`; defaults to `todo` |
| `createdAt` | ISO-8601 string | Yes | Canonical `deps.clock().toISOString()` value; immutable after creation |

Task JSON property order is `id`, `title`, optional `description`, `priority`,
`tags`, `status`, `createdAt`. The optional description property is omitted
when not present; it is not serialized as `null`.

## Task Collection

The configured storage file contains a JSON array of task objects in creation
order. Missing storage is equivalent to `[]`. For existing files, the root
value MUST be an array, and each element MUST satisfy the Task field/type and
enum rules above. IDs MUST be unique; tags MUST already be normalized,
nonempty, and unique; timestamps MUST be valid canonical ISO-8601 values;
unknown task properties are invalid. Malformed JSON or invalid stored shape is
a storage error.

Updates preserve array position. Deletes remove the item. Mutations are
serialized as compact JSON followed by one newline. Reads that fail or parse
invalid data MUST NOT be followed by a write.

## Status Transitions

| Operation | From | To | Result |
|-----------|------|----|--------|
| `status` | `todo` | `in_progress` | Allowed |
| `status` | `in_progress` | `done` | Allowed |
| `status` | `in_progress` | `todo` | Allowed |
| `reopen` | `done` | `todo` | Allowed |
| `status` | Any other pair, including same state | Any | Reject with exact transition error |
| `reopen` | `todo` or `in_progress` | `todo` | Reject with exact transition error |

## Listing

Filters use trimmed, lowercase tag values and exact whole-tag equality.
Repeated filters are combined with AND. Filtering happens before sorting.
Default order is the persisted creation order. Priority order is `high`,
`medium`, `low`; ties compare `createdAt` ascending and then `id` ascending
using deterministic string comparison.

## Injected Dependencies

`main` receives the storage path, a clock returning a `Date`, a string ID
factory, and stdout/stderr sinks. Tests supply deterministic values and
temporary file paths. Only the direct-execution composition root constructs
real dependencies.
