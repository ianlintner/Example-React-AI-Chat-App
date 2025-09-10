# Kubernetes DNSRecord Issue - Task Progress

We are troubleshooting the error:

```
error: resource mapping not found for name: "chat-dev-dns" namespace: "chat-dev" from "k8s/apps/chat/overlays/chat-dev": no matches for kind "DNSRecord" in version "networking.gke.io/v1"
ensure CRDs are installed
```

This indicates that the `DNSRecord` CRD from `networking.gke.io/v1` is not installed in the cluster.

---

## Task Progress

- [x] Analyze error and confirm missing CRD
- [x] Verify if `DNSRecord` CRD is part of GKE Gateway API or Cloud DNS Controller
- [x] Check if the CRD is installed in the cluster (`kubectl get crd | grep dnsrecord`)
- [ ] If missing, install the required CRD (likely from GKE Hub or Config Connector)
- [ ] Validate that `dns-record.yaml` in `chat-dev` overlay references the correct API version
- [ ] Apply manifests again and confirm resources are created successfully
- [ ] Document resolution in `k8s/README.md`

---

## Notes

- Running `kubectl apply -k k8s/apps/chat/overlays/chat-dev` confirms that all resources except the `DNSRecord` are created successfully.
- The error persists for both `chat-dev` and `chat-prod` overlays, which means the CRD is not present in the cluster.
- We confirmed that the cluster has `dnsrecordsets.dns.cnrm.cloud.google.com` (Config Connector) but **not** `DNSRecord.networking.gke.io/v1`.
- This means the manifests are referencing the wrong API group.
  - **Current:** `apiVersion: networking.gke.io/v1, kind: DNSRecord`
  - **Available:** `apiVersion: dns.cnrm.cloud.google.com/v1beta1, kind: DNSRecordSet`

---

## Next Step

- Update `k8s/apps/chat/overlays/chat-dev/dns-record.yaml` and `chat-prod/dns-records.yaml` to use the correct CRD (`DNSRecordSet` from Config Connector).
- Adjust fields to match Config Connector spec (e.g., `spec.ttl`, `spec.type`, `spec.rrdatas`).
