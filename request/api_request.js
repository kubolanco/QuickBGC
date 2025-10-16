document.addEventListener("DOMContentLoaded", () => {
    console.log("[DEBUG] DOM loaded, setting up form listener");
    const form = document.getElementById("bgcForm");

    form.addEventListener("submit", function(event) {
        event.preventDefault();
        console.log("[DEBUG] Form submitted");
        handleBGCFormSubmit();
    });
});

async function handleBGCFormSubmit() {
    const usernameOrId = document.getElementById("username").value.trim();
    const platform     = document.getElementById("platform").value;
    const reason       = document.getElementById("reason").value.trim();

    console.log("[DEBUG] Form values:", { usernameOrId, platform, reason });

    if (!usernameOrId || !reason) {
        console.log("[DEBUG] Missing username or reason, aborting");
        return;
    }

    try {
        if (platform.toLowerCase() === "roblox") {
            const userInfo = await getRobloxUserByUsername(usernameOrId);
            console.log("[DEBUG] Fetched userInfo:", userInfo);
            if (userInfo) await generatePDF(userInfo, reason, platform);
        } else {
            console.log("[DEBUG] Platform not supported:", platform);
        }
    } catch (err) {
        console.error("[DEBUG] Error in handleBGCFormSubmit:", err);
    }
}

// Fetch Roblox user info by username or ID using AllOrigins proxy
async function getRobloxUserByUsername(input) {
    let userId = input;
    const proxyUrl = "https://api.allorigins.win/raw?url=";

    console.log("[DEBUG] Resolving Roblox user ID for input:", input);

    try {
        // If input is not numeric, resolve username to ID
        if (isNaN(input)) {
            const searchUrl = encodeURIComponent(`https://users.roblox.com/v1/users/search?keyword=${input}&limit=1`);
            console.log("[DEBUG] Searching username via proxy:", proxyUrl + searchUrl);
            const searchRes = await fetch(proxyUrl + searchUrl);
            const searchData = await searchRes.json();
            console.log("[DEBUG] Search response:", searchData);
            if (!searchData.data || searchData.data.length === 0) return null;
            userId = searchData.data[0].id;
            console.log("[DEBUG] Resolved user ID:", userId);
        }

        const userRes = await fetch(proxyUrl + encodeURIComponent(`https://users.roblox.com/v1/users/${userId}`));
        const userData = await userRes.json();
        console.log("[DEBUG] User data response:", userData);

        const avatarRes = await fetch(proxyUrl + encodeURIComponent(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=48x48&format=Png`));
        const avatarData = await avatarRes.json();
        console.log("[DEBUG] Avatar data response:", avatarData);

        return {
            id: userData.id,
            username: userData.name,
            displayName: userData.displayName,
            created: userData.created,
            banned: userData.isBanned,
            avatar: avatarData.data[0].imageUrl
        };
    } catch (err) {
        console.error("[DEBUG] Error fetching Roblox user:", err);
        return null;
    }
}

// Convert avatar URL to base64 for PDF
async function loadImageAsDataURL(url) {
    console.log("[DEBUG] Loading image as Data URL:", url);
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => {
                console.log("[DEBUG] Image converted to Data URL");
                resolve(reader.result);
            };
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error("[DEBUG] Error loading image:", err);
        return null;
    }
}

// Generate and download PDF
async function generatePDF(userInfo, reason, platform) {
    if (!userInfo) {
        console.log("[DEBUG] No user info, skipping PDF generation");
        return;
    }

    console.log("[DEBUG] Generating PDF for user:", userInfo.username);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`${platform} Background Check Report`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Reason: ${reason}`, 10, 30);
    doc.text(`ID: ${userInfo.id}`, 10, 40);
    doc.text(`Username: ${userInfo.username}`, 10, 50);
    doc.text(`Display Name: ${userInfo.displayName}`, 10, 60);
    doc.text(`Created: ${new Date(userInfo.created).toLocaleString()}`, 10, 70);
    doc.text(`Banned: ${userInfo.banned}`, 10, 80);

    const avatarDataURL = await loadImageAsDataURL(userInfo.avatar);
    if (avatarDataURL) doc.addImage(avatarDataURL, "PNG", 150, 20, 40, 40);

    doc.save(`${userInfo.username}_BGC_Report.pdf`);
    console.log("[DEBUG] PDF saved for user:", userInfo.username);
}
