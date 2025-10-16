document.addEventListener("DOMContentLoaded", () => {
    console.log("[DEBUG] DOM loaded, setting up form listener");
    const form = document.getElementById("bgcForm");

    form.addEventListener("submit", function(event) {
        event.preventDefault();
        console.log("[DEBUG] Form submitted");
        handleBGCFormSubmit();
    });
});

// Cloudflare Worker proxy URL
const proxyUrl = "https://backendquickbgc.kubo-lanco.workers.dev/?url=";

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
            const userInfo = await getRobloxUserInfo(usernameOrId);
            console.log("[DEBUG] Fetched userInfo:", userInfo);
            if (userInfo) await generatePDF(userInfo, reason, platform);
        } else {
            console.log("[DEBUG] Platform not supported:", platform);
        }
    } catch (err) {
        console.error("[DEBUG] Error in handleBGCFormSubmit:", err);
    }
}

// Fetch Roblox user info safely
async function getRobloxUserInfo(input) {
    let userId = input;

    try {
        // Resolve username to ID if needed
        if (isNaN(input)) {
            const searchUrl = encodeURIComponent(`https://users.roblox.com/v1/users/search?keyword=${input}&limit=10`);
            console.log("[DEBUG] Searching username via worker:", proxyUrl + searchUrl);
            const searchRes = await fetch(proxyUrl + searchUrl);
            const searchData = await searchRes.json();
            console.log("[DEBUG] Search response:", searchData);
            if (!searchData.data || searchData.data.length === 0) return null;
            userId = searchData.data[0].id;
            console.log("[DEBUG] Resolved user ID:", userId);
        }

        // User basic info
        const userRes = await fetch(proxyUrl + encodeURIComponent(`https://users.roblox.com/v1/users/${userId}`));
        const userData = await userRes.json();
        console.log("[DEBUG] User data:", userData);

        const description = userData.description || "N/A";

        // Friends count
        let friendsCount = 0;
        try {
            const friendsRes = await fetch(proxyUrl + encodeURIComponent(`https://friends.roblox.com/v1/users/${userId}/friends`));
            const friendsData = await friendsRes.json();
            friendsCount = friendsData.count ?? 0;
        } catch { friendsCount = 0; }

        // Followers count
        let followersCount = 0;
        try {
            const followersRes = await fetch(proxyUrl + encodeURIComponent(`https://friends.roblox.com/v1/users/${userId}/followers`));
            const followersData = await followersRes.json();
            followersCount = followersData.count ?? 0;
        } catch { followersCount = 0; }

        // Following count
        let followingCount = 0;
        try {
            const followingRes = await fetch(proxyUrl + encodeURIComponent(`https://friends.roblox.com/v1/users/${userId}/followings`));
            const followingData = await followingRes.json();
            followingCount = followingData.count ?? 0;
        } catch { followingCount = 0; }

        // Groups count
        let groupsCount = 0;
        try {
            const groupsRes = await fetch(proxyUrl + encodeURIComponent(`https://groups.roblox.com/v1/users/${userId}/groups/roles`));
            const groupsData = await groupsRes.json();
            groupsCount = groupsData.data?.length ?? 0;
        } catch { groupsCount = 0; }

        // Badges count
        let badgesCount = 0;
        try {
            const badgesRes = await fetch(proxyUrl + encodeURIComponent(`https://badges.roblox.com/v1/users/${userId}/badges`));
            const badgesData = await badgesRes.json();
            badgesCount = badgesData.data?.length ?? 0;
        } catch { badgesCount = 0; }

        // Avatar URL
        let avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=48x48&format=Png`;

        return {
            id: userData.id,
            username: userData.name,
            displayName: userData.displayName,
            created: userData.created,
            description: description,
            banned: userData.isBanned,
            friendsCount,
            followersCount,
            followingCount,
            connections: friendsCount + followersCount + followingCount,
            groupsCount,
            badgesCount,
            avatar: avatarUrl
        };

    } catch (err) {
        console.error("[DEBUG] Error fetching Roblox user info:", err);
        return null;
    }
}

// Convert avatar to base64 for PDF, safely
async function loadImageAsDataURL(url) {
    if (!url) return null;
    try {
        const response = await fetch(proxyUrl + encodeURIComponent(url));
        if (!response.ok) return null; // failed fetch
        const blob = await response.blob();
        if (!blob || blob.size === 0) return null; // empty image

        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.error("[DEBUG] Error loading avatar image:", err);
        return null;
    }
}

// Generate and download PDF
async function generatePDF(userInfo, reason, platform) {
    if (!userInfo) return;

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
    doc.text(`Description: ${userInfo.description}`, 10, 90);
    doc.text(`Connections: ${userInfo.connections}`, 10, 100);
    doc.text(`Friends: ${userInfo.friendsCount}`, 10, 110);
    doc.text(`Followers: ${userInfo.followersCount}`, 10, 120);
    doc.text(`Following: ${userInfo.followingCount}`, 10, 130);
    doc.text(`Groups: ${userInfo.groupsCount}`, 10, 140);
    doc.text(`Badges: ${userInfo.badgesCount}`, 10, 150);

    // Safely add avatar
    const avatarDataURL = await loadImageAsDataURL(userInfo.avatar);
    if (avatarDataURL && avatarDataURL.startsWith("data:image/png;base64,")) {
        doc.addImage(avatarDataURL, "PNG", 150, 20, 40, 40);
    } else {
        console.warn("[DEBUG] Avatar image invalid, skipping in PDF.");
    }

    doc.save(`${userInfo.username}_BGC_Report.pdf`);
    console.log("[DEBUG] PDF saved for user:", userInfo.username);
}
