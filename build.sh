target=$1
echo building target $target
shift
bun build $target/src/index.tsx --outdir $target/dist --minify --sourcemap=linked $@
