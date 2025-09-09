# Chat Kubernetes Manifests

This directory contains the Kubernetes manifests for deploying the **chat** application into a Google Kubernetes Engine (GKE) cluster.  
The structure is modeled after the reference in `~/portfolio/k8s`.

## Structure

```
k8s/
  apps/
    chat/
      base/                # Base manifests (deployment, service, serviceaccount, istio configs)
      overlays/
        chat-dev/          # Dev environment overlays
        chat-prod/         # Prod environment overlays
  flux/                    # FluxCD kustomizations for environments
```

## Next Steps

- Populate `apps/chat/base` with:
  - `deployment.yaml`
  - `service.yaml`
  - `serviceaccount.yaml`
  - `istio-gateway.yaml`
  - `istio-virtualservice.yaml`
  - `istio-certificate.yaml`
  - `kustomization.yaml`

- Populate `apps/chat/overlays/chat-dev` with:
  - `namespace.yaml`
  - `dns-record.yaml`
  - `kustomization.yaml`

- Populate `apps/chat/overlays/chat-prod` with:
  - `namespace.yaml`
  - `dns-records.yaml`
  - `workload-identity-binding.yaml`
  - `kustomization.yaml`

- Add FluxCD kustomizations under `k8s/flux`.
