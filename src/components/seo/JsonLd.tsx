export function LocalBusinessJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physiotherapy",
    name: "The Rehab Studio",
    description:
      "Centro de fisioterapia especializado en fisioterapia deportiva, invasiva y EPI en Zaragoza. Tratamientos personalizados con tecnología avanzada.",
    url: "https://therehabstudio.es",
    telephone: "+34639380630",
    email: "info@therehabstudio.es", // TODO: Añadir email real
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calle Dr Cerrada 29, Local 3",
      addressLocality: "Zaragoza",
      addressRegion: "Aragón",
      postalCode: "50005",
      addressCountry: "ES",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 41.6561,
      longitude: -0.8833,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "20:00",
      },
    ],
    sameAs: ["https://www.instagram.com/the.rehabstudio"],
    priceRange: "€€",
    image: "https://therehabstudio.es/og-image.jpg",
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Centro Autorizado EPI",
    },
    medicalSpecialty: [
      "Fisioterapia Deportiva",
      "Fisioterapia Invasiva",
      "EPI - Electrólisis Percutánea Intratisular",
      "Punción Seca",
      "Ecografía Musculoesquelética",
      "Terapia Manual",
      "Ejercicio Terapéutico",
    ],
    areaServed: {
      "@type": "City",
      name: "Zaragoza",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebsiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Rehab Studio",
    url: "https://therehabstudio.es",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://therehabstudio.es/?s={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function BreadcrumbJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: "https://therehabstudio.es",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Servicios",
        item: "https://therehabstudio.es/#servicios",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Contacto",
        item: "https://therehabstudio.es/#contacto",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
