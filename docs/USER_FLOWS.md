# azentio.ai portal: User flows

## 4.1 Public visitor
```mermaid
flowchart LR
  A[Home] --> B[Offerings catalogue] --> C[Offering detail + approved media]
  C --> D{CTA}
  D -->|Request demo| E[Demo form → validated → stored → thank-you]
  D -->|Hackathon/event| F[Registration form → confirmation]
  A --> G[Insights / About]
  A -.->|tries /c/* or /e/*| H[Redirect to login]
```

## 4.2 Employee sign-in & portal
```mermaid
flowchart TD
  L[Login: enter @azentio.com email] --> O[OTP sent] --> V[Enter code]
  V --> Q{On allow-list?}
  Q -->|no| X[Access pending: contact admin]
  Q -->|yes| D[Employee dashboard]
  D --> P[Playground: pick offering → inspect synthetic inputs → run → evidence → feedback]
  D --> LV[Internal Live / recordings]
  D --> I[Assigned ideas]
  D --> T[Themes → create idea → link evidence → set status]
```

## 4.3 Client first-time onboarding
```mermaid
flowchart TD
  A[Client admin invites email + role] --> B[Email with single-use expiring link]
  B --> C[Open link → OTP verify]
  C --> D{Verified email == invited email AND unexpired AND unused?}
  D -->|no| E[Error: ask admin to re-invite]
  D -->|yes| F[Workspace terms + how sharing works<br/>Joining ≠ consent to share/train]
  F --> G[Client dashboard: active org shown, entitled features only]
  G --> H{Multiple memberships?}
  H -->|yes| I[Workspace switcher]
```

## 4.4 Contribute an observation
```mermaid
flowchart TD
  A[New observation] --> B[Fill structured form + sensitive-data guidance]
  B --> C[Save → private draft]
  C --> D{Sharing choice}
  D -->|Private| E[Stays private]
  D -->|My org| F[Visible to own org only]
  D -->|Propose to community| G[Consents: publish ☐ attribute ☐ train ☐]
  G --> H[Submit → PII rules scan → state=submitted]
  H --> I[Track status + 'who can see this' panel]
```

## 4.5 Moderation
```mermaid
flowchart TD
  Q[Moderation queue: submitted items, PII flags] --> R[Open item: source left, editable shared copy right, AI redaction suggestion]
  R --> S{Decision}
  S -->|Needs info| T[Request clarification → returned → author amends → resubmit]
  S -->|Duplicate/unsafe| U[Reject with reason]
  S -->|OK| V[Publish reviewed fields only → shared feed + embed]
  T --> Q
  V --> N[Author notified in-app/email]
  U --> N
```

## 4.6 Report, withdraw, edit
```mermaid
flowchart LR
  A[Any viewer: Report] --> B[Moderator review] --> C{Upheld?}
  C -->|temp| D[Unpublish] --> E[Decide: restore / withdraw]
  C -->|no| F[Dismiss, note recorded]
  G[Author: Withdraw] --> H[Purge feed, index, cache, AIRA ≤60s] --> I[Notice: already-viewed copies can't be recalled]
  J[Author edits published item] --> K[New version → submitted → re-review]
```

## 4.7 Insight → improvement loop (brief's scenario)
```mermaid
flowchart LR
  A[3 orgs submit SME seasonality observations] --> B[Moderator redacts, clarifies, publishes]
  B --> C[Clustering → 'Seasonality context' theme, small-sample warning]
  C --> D[PO creates idea for Financial Analysis Intelligence, status Under review]
  D --> E[Clients see theme + status; drafts and notes stay private]
```

## 4.8 Client admin
Members page → Invite (email, role ∈ {member, admin}) → pending list → revoke. Trying to grant moderator/employee returns an error (server + RLS).

## 4.9 AIRA
Ask → retrieve visible published items → answer with [S#] source cards, or "not enough evidence" → 👍 / 👎 / correct → logged for metrics.

## 4.10 Federated programme (P2)
Admin creates programme → client orgs opt in (train consent) → run → rounds view (participants, dropout, metrics vs baseline) → candidate model → human approve/reject → rollback option.
