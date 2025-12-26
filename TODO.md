# TODO: Enhance Image Editor - Remove Filters, Add Reflect/Turn/Crop

## Tasks
- [ ] Remove filter-related variables (brightness, contrast, saturation, hue) from ImageEditor constructor
- [ ] Add new variables: flipH, flipV, scale, cropX, cropY, cropW, cropH
- [ ] Update redraw() method to apply rotation, flip, scale, and cropping without filters
- [ ] Update attachEventListeners() to add flip button functionality
- [ ] Update attachEventListeners() to add scale slider functionality
- [ ] Update attachEventListeners() to add square crop button functionality
- [ ] Remove old filter slider and reset button code from attachEventListeners()
- [ ] Set initial crop to full image size in init()
- [ ] Define updateCrop() method properly
- [ ] Test image upload and editing functionality
