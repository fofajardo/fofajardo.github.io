const URL_DATA = "assets/data.json";
const URL_CDN = "https://cdnjs.cloudflare.com/ajax/libs/";

const TYPE_ACADEMIC = 0;
const TYPE_PERSONAL = 1;

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
    _redirectToIndex: function (aFragment) {
        let target = window.location.href.substring(
            0, window.location.href.lastIndexOf("/"))
            .replace("projects", "");
        if (aFragment) {
            target += `#${aFragment}`;
        }
        window.location.replace(target);
    },
    
    buildDetails: async function (aSlug) {
        // Redirect user to home page if we don't know what project to show.
        if (!aSlug) {
            gSite._redirectToIndex();
            return;
        }
        
        await System.import(`${URL_CDN}marked/5.1.1/marked.min.js`);

        let data = await gAPI.getData();
        let projects = data.projects;
        let technologies = data.technologies;

        let entry = projects.find((e) => e.id == aSlug);
        if (!entry) {
            gSite._redirectToIndex();
        }

        document.title += ` - ${entry.title}`

        let sectionTitle = $("details-title");
        sectionTitle.innerText = entry.title;
        let detailSubtitle = $("details-subtitle");
        detailSubtitle.innerText = entry.subtitle;
        let detailDuration = $("details-duration");
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

        let card = createBox("card", `project-${entry.id}`);
        if ("previewset" in entry && entry.previewset) {
            let slidesTarget = $("glide-slides");
            for (let i = 0; i < entry.previewset.length; i++) {
                let img = entry.previewset[i];
                let slideImage = create("img", "glide__slide");
                slideImage.src = `assets/images/previewset/${img}`;
                slideImage.addEventListener("click", function () {
                    gSite.onViewImage(slideImage, entry, i);
                });
                let slideItem = create("li");
                slideItem.appendChild(slideImage);
                slidesTarget.appendChild(slideItem);
            }

            let baseUrl = `${URL_CDN}Glide.js/3.6.0/`;
            await System.import(`${baseUrl}glide.min.js`);
            document.getElementsByTagName('head')[0].insertAdjacentHTML(
                "beforeend",
                `<link rel="stylesheet" href="${baseUrl}css/glide.core.min.css" />`);
                
            new Glide('.glide', {
                type: "carousel",
                autoplay: 3000,
                hoverpause: false,
                perView: 3,
                breakpoints: {
                    767: {
                        perView: 1
                    }
                }
            }).mount()
        }

        let detailBox = createBox("card-detail");
        card.appendChild(detailBox);

        let detailTech = createBox("card-tech");
        detailBox.appendChild(detailTech);

        if (entry.technologies) {
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
        }
        
        if (entry.points) {
            var detailPoints = create("ul");
            for (let point of entry.points) {
                pointListItem = create("li");
                pointListItem.innerHTML = await parseMarkdown(point);
                detailPoints.appendChild(pointListItem);
            }
            detailBox.appendChild(detailPoints);
        }

        if ("content" in entry) {
            detailBox.innerHTML += await parseMarkdown(entry.content);
        }

        let content = $("cardset-details");
        content.appendChild(card);
        
        $("action-back").addEventListener("click", function () {
            gSite._redirectToIndex(`project-${entry.id}`);
        });
        
        let actionVisit = $("action-visit-url");
        if ("url" in entry && entry.url) {
            actionVisit.target = "_blank";
            actionVisit.href = entry.url;
            actionVisit.hidden = false;
        }
    },
    
    buildProjects: async function (aType, aSet) {
        let data = await gAPI.getData();
        let projects = data.projects.filter((e) => e.type == aType);
        let technologies = data.technologies;

        let projectSet = $(aSet);
        for (let entry of projects) {
            let cardAnchor = create("a", "card-anchor");
            cardAnchor.href = window.location.href.substring(
                0, window.location.href.lastIndexOf("/") + 1)
                + "projects?id=" + entry.id;
            
            let card = createBox("card", `project-${entry.id}`);
            if ("preview" in entry) {
                let previewBox = createBox("card-preview");
                let previewPlaceholder = createBox("card-preview-placeholder phs");

                // Preview picture: image and its alternate sources.
                let previewPicture = create("picture");
                previewPlaceholder.appendChild(previewPicture);

                let baseSourceUrl = `assets/images/previews/${entry.preview}`;

                let previewWebpSource = create("source");
                previewWebpSource.type = "image/webp";
                previewWebpSource.srcset = `${baseSourceUrl}.webp`;
                previewPicture.appendChild(previewWebpSource);

                let previewJpegSource = create("source");
                previewJpegSource.type = "image/jpeg";
                previewJpegSource.srcset = `${baseSourceUrl}.jpg`;
                previewPicture.appendChild(previewJpegSource);

                let previewImage = create("img", "img-uiv", "", `${entry.title} preview image`);
                previewImage.width = "200";
                previewImage.height = "200";
                previewImage.src = `${baseSourceUrl}.jpg`;
                previewImage.classList.add("loading");
                previewImage.addEventListener("load", async function () {
                    previewImage.classList.remove("loading");
                    previewPlaceholder.classList.remove("phs");
                });
                previewImage.addEventListener("error", function () {
                    previewImage.hidden = true;
                    previewPlaceholder.classList.add("missing");
                });
                previewPicture.appendChild(previewImage);
                previewBox.appendChild(previewPlaceholder);
                card.appendChild(previewBox);
            }

            let detailBox = createBox("card-detail");
            card.appendChild(detailBox);

            let detailTitle = createBox("card-header");
            detailBox.appendChild(detailTitle);

            let detailTitleText = create("span");
            detailTitleText.innerText = entry.title;
            detailTitleText.classList.add("header-link");
            detailTitle.appendChild(detailTitleText);

            let detailSubtitle = create("div", "card-subtitle fw-bold");
            detailSubtitle.innerText = entry.subtitle;
            detailBox.appendChild(detailSubtitle);

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
            detailBox.appendChild(detailDuration);

            cardAnchor.appendChild(card);
            projectSet.appendChild(cardAnchor);
        }
    },

    viewerLoaded: false,
    onViewImage: async function (aImage, aEntry, aIndex) {
        if (!aImage.viewer) {
            if (!gSite.viewerLoaded) {
                let baseUrl = `${URL_CDN}viewerjs/1.11.3/viewer.min`;
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
        aImage.viewer.view(aIndex);
    },

    onLoad: async function () {
        var urlParameters = new URLSearchParams(window.location.search);
        var detailSlug = urlParameters.get("id");
        var detailBox = $("details");

        if (detailBox) {
            await gSite.buildDetails(detailSlug);
        } else {
            await gSite.buildProjects(TYPE_ACADEMIC, "cardset-projects");
            await gSite.buildProjects(TYPE_PERSONAL, "cardset-personalprojects");
        }
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
