# Flux autodeploy for chat-backend

This directory contains the GitOps configuration that lets Flux pick up
every successful CI build of `gabby.azurecr.io/chat-backend` and roll
the `chat-backend` Deployment in the `default` namespace of the
`bigboy` cluster.

## Layout

```
k8s/flux/
├── apps/chat/
│   ├── image-repository.yaml        # Scans ACR every minute
│   ├── image-policy.yaml            # Selects newest YYYYMMDDHHmmss-<sha> tag
│   ├── image-update-automation.yaml # Commits tag bumps back to main
│   └── kustomization.yaml
├── clusters/bigboy/
│   └── chat-app.yaml                # Two Flux Kustomizations (app + automation)
└── README.md (this file)
```

The deployment manifest (`k8s/apps/chat/deployment.yaml`) carries the
`# {"$imagepolicy": "flux-system:chat-backend"}` marker on the
`image:` line. On each reconcile Flux rewrites that line in place and
pushes the change back to `main`, which then flows through the
`chat-app` Kustomization and into the live Deployment.

## One-time bootstrap

1. **Install Flux (if not already present).** Requires a GitHub PAT
   with `repo` scope exported as `$GITHUB_TOKEN`:

   ```sh
   export GITHUB_TOKEN=<pat>
   flux bootstrap github \
     --owner=ianlintner \
     --repository=Example-React-AI-Chat-App \
     --branch=main \
     --path=k8s/flux/clusters/bigboy \
     --components-extra=image-reflector-controller,image-automation-controller \
     --personal
   ```

   The `--components-extra` flag installs the image-reflector /
   image-automation controllers that this directory depends on — the
   default Flux bootstrap does not ship them.

2. **Create the ACR pull secret** used by the `ImageRepository` to
   scan tags:

   ```sh
   ACR_TOKEN=$(az acr login --name gabby --expose-token \
     --output tsv --query accessToken)
   kubectl -n flux-system create secret docker-registry acr-pull \
     --docker-server=gabby.azurecr.io \
     --docker-username=00000000-0000-0000-0000-000000000000 \
     --docker-password="$ACR_TOKEN"
   ```

   The `--expose-token` flow returns a short-lived AAD token (typically
   3 hours). For production wire workload-identity to grant the Flux
   SA the `AcrPull` role on the registry, or rotate this secret via a
   scheduled job.

3. **Verify the automation loop.** After the next merge to `main`, the
   CI build pushes a new `YYYYMMDDHHmmss-<sha>` tag. Within a minute
   Flux should:
   - update `image-reflector` inventory: `flux get images repository chat-backend`
   - resolve the newest tag: `flux get images policy chat-backend`
   - commit a change to `k8s/apps/chat/deployment.yaml` on `main`
   - reconcile the `chat-app` Kustomization, triggering a rolling
     update of the `chat-backend` Deployment.

## Disabling

`LLM_TIERED` in `chat-backend-config` can be flipped to `'false'` to
turn tier routing off without a code redeploy. Setting
`suspend: true` on the `chat-image-automation` Kustomization freezes
image updates without removing the controller.
