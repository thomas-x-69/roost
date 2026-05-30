# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Roost, please **do not open a
public issue.** Instead, report it privately:

- Open a [GitHub Security Advisory](../../security/advisories/new) (preferred), or
- Email the maintainers (see repository contact).

Please include a description, reproduction steps, and the affected version /
commit. We aim to acknowledge reports within a few days.

## Security model & operator responsibilities

Roost is a **self-hosted, single-operator tool**. Its threat model assumes
the operator is trusted and runs it on a network they control.

- **Bind address.** By default Roost binds to `127.0.0.1` (localhost only),
  so the control API and UI are reachable only from the machine running it.
  This is the recommended configuration.
- **No built-in authentication.** Like local desktop network tools, Roost
  has no login. If you change `HOST` to `0.0.0.0` or any LAN-reachable address,
  **anyone on that network can control Roost** — including disconnecting
  devices. Only expose it on a trusted, access-controlled network, and put it
  behind a reverse proxy with authentication/TLS if remote access is required.
- **Privileges.** Packet capture and ARP-based access control require
  administrator/root privileges and a packet driver (Npcap on Windows,
  libpcap on Linux/macOS). Run with the least privilege that works for you.
- **Hosts-file changes.** The threat-blocking feature edits the system hosts
  file; domains are validated before being written. This requires admin rights.

## Supported versions

Roost is pre-1.0. Security fixes are applied to the latest `main`.
