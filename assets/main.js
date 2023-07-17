const URL_DATA = "assets/data.json";

var gAPI = {
    request: async function (aUrl, aHeaders = new Headers()) {
        let cacheKey = btoa(aUrl);
        let cacheETagKey = `${cacheKey}_ETag`;

        let data = localStorage.getItem(cacheKey);
        let etag = localStorage.getItem(cacheETagKey);
        if (data && etag) {
            data = JSON.parse(data);
            aHeaders.append("If-None-Match", etag);
        }

        var isCached = false;
        await fetch(aUrl, {
            method: "GET",
            headers: aHeaders,
        }).then(async function (aResponse) {
            switch (aResponse.status) {
                case 304:
                    console.log(`Loading resource from cache: ${aUrl}`);
                    // Take response data from local storage
                    isCached = true;
                    break;
                case 200:
                    data = await aResponse.json();
                    console.log(`Saving resource to cache: ${aUrl}`);
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    localStorage.setItem(cacheETagKey, aResponse.headers.get("etag"));
                    break;
                default:
                    break;
            }
        }).catch(function (aException) {
            console.error(aException);
            data = {
                message: aException.message
            };
        });

        return {
            json: data,
            isCached: isCached,
            cacheKey: cacheKey,
        };
    },

    _data: null,
    getData: async function () {
        if (this._data == null) {
            let response = await this.request(URL_DATA);
            this._data = response.json;
        }
        return this._data;
    },
};

function $(aId) {
    return document.getElementById(aId);
}

function create(aTagName, aClass = "", aId = "", aAltText = "") {
    let element = document.createElement(aTagName);
    if (aClass != "") {
        element.className = aClass;
    }
    if (aId != "") {
        element.id = aId;
    }
    if (aAltText != "") {
        element.alt = aAltText;
    }
    return element;
}

function createBox(aClass = "", aId = "") {
    return create("div", aClass, aId);
}

function parseMarkdown(aText) {
    let parsedValue = marked.parse(aText, { headerIds: false, mangle: false });
    return parsedValue;
}

var gSite = {
    buildProjects: async function () {
        await System.import("https://cdnjs.cloudflare.com/ajax/libs/marked/5.1.1/marked.min.js")
        let data = await gAPI.getData();
        let projects = data.projects;
        let technologies = data.technologies;

        let projectSet = $("cardset-projects");
        for (let entry of projects) {
            let card = createBox("card", `project-${entry.id}`);
            if ("preview" in entry) {
                let previewBox = createBox("card-preview");
                let previewPlaceholder = createBox("card-preview-placeholder phs");
                let previewImage = create("img", "img-uiv", "", `${entry.title} preview image`);
                previewImage.src = `assets/images/previews/${entry.preview}`;
                previewImage.classList.add("loading");
                previewImage.addEventListener("load", async function () {
                    previewImage.addEventListener("click", function () {
                        gSite.onViewImage(previewImage, entry);
                    });
                    previewImage.classList.remove("loading");
                    previewPlaceholder.classList.remove("phs");
                });
                previewImage.addEventListener("error", function () {
                    previewImage.hidden = true;
                    previewPlaceholder.classList.add("missing");
                });
                
                let iconBox = createBox("preview-icon-box");
                iconBox.addEventListener("click", function () {
                    previewImage.click();
                });
                let icon = create("span", "preview-icon iconify");
                icon.dataset.icon = "mdi:image-multiple-outline";
                iconBox.appendChild(icon);
                
                previewPlaceholder.appendChild(previewImage);
                previewBox.appendChild(previewPlaceholder);
                previewBox.appendChild(iconBox);
                card.appendChild(previewBox);
            }

            let detailBox = createBox("card-detail");
            card.appendChild(detailBox);

            let detailTitle = createBox("card-header");
            detailBox.appendChild(detailTitle);

            let detailTitleText = create("span");
            detailTitleText.innerText = entry.title;

            if ("url" in entry && entry.url) {
                let detailTitleLink = create("a", "header-link");
                detailTitleLink.target = "_blank";
                detailTitleLink.href = entry.url;
                let linkIcon = create("span", "link-icon iconify");
                linkIcon.dataset.icon = "mdi:open-in-new";
                detailTitleLink.appendChild(detailTitleText);
                detailTitleLink.appendChild(linkIcon);
                detailTitle.appendChild(detailTitleLink);
            } else {
                detailTitleText.classList.add("header-link");
                detailTitle.appendChild(detailTitleText);
            }

            let detailDuration = create("span");
            if (entry.dateStart) {
                detailDuration.innerText += entry.dateStart;
            }
            if ("dateEnd" in entry) {
                if (entry.dateEnd) {
                    detailDuration.innerText += ` – ${entry.dateEnd}`;
                }
            } else {
                detailDuration.innerText += ` – Present`;
            }
            detailTitle.appendChild(detailDuration);
            
            let detailSubtitle = createBox("card-subtitle");
            detailSubtitle.innerText = entry.subtitle;
            detailBox.appendChild(detailSubtitle);

            let detailTech = createBox("card-tech");
            detailBox.appendChild(detailTech);

            let detailTechLabel = create("span", "fw-bold");
            detailTechLabel.innerText = "Technologies: ";
            detailTech.appendChild(detailTechLabel);
            let detailTechList = create("span");
            for (let i = 0; i < entry.technologies.length; i++) {
                techName = entry.technologies[i];
                techFriendlyName = techName;
                if (techName in technologies) {
                    techFriendlyName = technologies[techName];
                }
                detailTechList.innerText += techFriendlyName;
                if (i < entry.technologies.length - 1) {
                    detailTechList.innerText += ", ";
                }
            }
            detailTech.appendChild(detailTechList);

            var detailPoints = create("ul");
            for (let point of entry.points) {
                pointListItem = create("li");
                pointListItem.innerHTML = await parseMarkdown(point);
                detailPoints.appendChild(pointListItem);
            }
            detailBox.appendChild(detailPoints);

            if ("extraInfo" in entry) {
                detailBox.innerHTML += await parseMarkdown(entry.extraInfo);
            }

            projectSet.appendChild(card);
        }
    },

    viewerLoaded: false,
    onViewImage: async function (aImage, aEntry) {
        if (!aImage.viewer) {
            if (!gSite.viewerLoaded) {
                let baseUrl = "https://cdnjs.cloudflare.com/ajax/libs/viewerjs/1.11.3/viewer.min";
                await System.import(`${baseUrl}.js`);
                document.getElementsByTagName('head')[0].insertAdjacentHTML(
                    "beforeend",
                    `<link rel="stylesheet" href="${baseUrl}.css" />`);
                gSite.viewerLoaded = true;
            }
            let viewerTarget = aImage;
            if ("previewset" in aEntry && aEntry.previewset) {
                viewerTarget = create("ul", "previewset");
                for (let img of aEntry.previewset) {
                    let galleryImage = create("img");
                    galleryImage.src = `assets/images/previewset/${img}`;
                    let galleryImageListItem = create("li");
                    galleryImageListItem.appendChild(galleryImage);
                    viewerTarget.appendChild(galleryImageListItem);
                }
            }
            aImage.viewer = new Viewer(
                viewerTarget,
                {
                    inline: false,
                    title: false,
                }
            );
        }
        // Since Viewer.js will handle clicks for the hidden
        // viewer target instead of the preview image, we have
        // to do this manually instead.
        aImage.viewer.show();
    },

    onLoad: async function () {
        await gSite.buildProjects();
        gSite.doneLoading();
    },

    onDeferredLoad: function () {
    },

    doneLoading: function () {
        document.body.dataset.loaded = true;
        // Handle the fragment identifier, necessary if the anchor
        // is dynamically generated.
        let fragmentId = window.location.hash.substr(1);
        if (fragmentId) {
            let targetElement = $(fragmentId);
            if (targetElement) {
                targetElement.scrollIntoView(true);
            }
        }
    },
};

window.addEventListener("DOMContentLoaded", gSite.onLoad);
window.addEventListener("load", gSite.onDeferredLoad);
