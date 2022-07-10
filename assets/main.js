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

function create(aTagName, aClass = "", aId = "") {
    let element = document.createElement(aTagName);
    element.className = aClass;
    element.id = aId;
    return element;
}

function createBox(aClass = "", aId = "") {
    return create("div", aClass, aId);
}

function createTitleLink(aTitle, aUrl) {
    let titleAnchor = create("a", "header-link");
    let titleText = create("span");
    titleText.innerText = aTitle;
    titleAnchor.appendChild(titleText);

    if (aUrl) {
        titleAnchor.target = "_blank";
        titleAnchor.href = aUrl;
        linkIcon = create("span", "link-icon iconify");
        linkIcon.dataset.icon = "mdi:open-in-new";
        titleAnchor.appendChild(linkIcon);
    }

    return titleAnchor;
}

async function parseMarkdown(aText) {
    let parsedValue = "";
    await System.import("./assets/libs/marked/marked.min.js")
        .then(function () {
            parsedValue = marked.parse(aText);
        });
    return parsedValue;
}

var gSite = {
    buildProjects: async function () {
        let data = await gAPI.getData();
        let projects = data.projects;
        let technologies = data.technologies;

        let projectSet = $("cardset-projects");
        for (let i = 0; i < projects.length; i++) {
            let entry = projects[i];

            let card = createBox("card");
            if ("preview" in entry) {
                let previewBox = createBox("card-preview");
                let previewPlaceholder = createBox("card-preview-placeholder");
                let previewImage = create("img");
                // TODO: implement gallery view
                previewImage.src = `assets/images/previews/${entry.preview}`;
                previewImage.onerror = function () {
                    previewImage.hidden = true;
                    previewPlaceholder.classList.add("missing");
                };
                previewPlaceholder.appendChild(previewImage);
                previewBox.appendChild(previewPlaceholder);
                card.appendChild(previewBox);
            }

            let detailBox = createBox("card-detail");
            card.appendChild(detailBox);

            let detailTitle = createBox("card-header");
            detailBox.appendChild(detailTitle);

            let detailTitleLink = createTitleLink(entry.title, entry.url);
            detailTitle.appendChild(detailTitleLink);
            let detailDuration = create("span");
            if (entry.dateStart) {
                detailDuration.innerText += entry.dateStart;
            }
            if (entry.dateEnd) {
                if (entry.dateEnd != entry.dateStart) {
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
            for (let j = 0; j < entry.technologies.length; j++) {
                techName = entry.technologies[j];
                techFriendlyName = techName;
                if (techName in technologies) {
                    techFriendlyName = technologies[techName];
                }
                detailTechList.innerText += techFriendlyName;
                if (j < entry.technologies.length - 1) {
                    detailTechList.innerText += ", ";
                }
            }
            detailTech.appendChild(detailTechList);

            var detailPoints = create("ul");
            for (let k = 0; k < entry.points.length; k++) {
                point = entry.points[k];
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

    onLoad: async function () {
        await gSite.buildProjects();

        gSite.doneLoading();
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
