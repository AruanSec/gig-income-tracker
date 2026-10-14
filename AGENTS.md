# Project working instructions

## Required branch and staging workflow

The user requires this workflow for all future changes, including documentation and configuration changes:

1. Start from an up-to-date `main` branch and create a descriptive feature branch, such as `feature/<change-name>`.
2. Make and commit the changes on the feature branch. Do not edit or commit directly on `main`.
3. Integrate the feature branch into `staging`. Create `staging` from `main` if it does not exist. Preserve any other work already on `staging`.
4. Test the integrated changes on `staging` using checks appropriate to the change. For application changes, run the relevant tests, TypeScript checking, and production build. Verify documentation and configuration changes with the appropriate syntax and configuration checks.
5. If staging checks fail, fix the issue on the feature branch, reintegrate it into `staging`, and rerun the affected checks. Do not promote failing changes to `main`.
6. Merge the tested feature into `main` only after staging checks pass. Ensure the promoted changes match those tested; if integration changes the result, test that result on `staging` before promotion. Do not include unrelated staging work in the promotion.
7. Report the branches used, checks run, and resulting commit. Leave existing feature branches intact unless the user requests cleanup.

Testing on the `staging` branch is required. Deployment to a staging server is a separate action and must not be claimed unless it actually occurred.
