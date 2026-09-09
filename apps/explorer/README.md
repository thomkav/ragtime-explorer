# apps/explorer

The Explorer page itself. Not started.

It begins from the mock, not from the endpoint spike's throwaway page, and it renders the
events `@ragtime/client` yields from `POST /explorer/turn`: a conversation in the centre, the
trail beside it (tool calls with summary, time and cost; workspace handoffs), the brief card
between orient and research, and sources under each answer. The design questions the first
real turns raised are on benjaminwittes/ragtime-dev#168 with a recommendation on each; the
answers decide this app's first shape.

Framework: React, assumed. The client package is framework-free so that stays a per-app choice.
