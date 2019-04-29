(cd web/src/js && npx babel ./** --out-dir ../../dist/js --presets react-app/prod --watch) &
(cd web/src/vendor && cp -r ./ ../../dist/vendor) &
(cd web/src/res && cp -r ./ ../../dist/res) &
(cd web/src/style && npx sass ./:../../dist/style/ --watch)
