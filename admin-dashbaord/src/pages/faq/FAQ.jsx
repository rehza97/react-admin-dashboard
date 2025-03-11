import { useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  TextField,
  InputAdornment,
  Divider,
  Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ExpandAllIcon from "@mui/icons-material/UnfoldMore";
import CollapseAllIcon from "@mui/icons-material/UnfoldLess";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";

const FAQ = () => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : "");
  };

  const handleExpandAll = () => {
    setExpanded("all");
  };

  const handleCollapseAll = () => {
    setExpanded("");
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  const faqItems = [
    {
      id: "faq.general.navigation",
      category: "general",
      question: t("faq.general.navigation.question"),
      answer: t("faq.general.navigation.answer"),
    },
    {
      id: "faq.general.language",
      category: "general",
      question: t("faq.general.language.question"),
      answer: t("faq.general.language.answer"),
    },
    {
      id: "faq.general.theme",
      category: "general",
      question: t("faq.general.theme.question"),
      answer: t("faq.general.theme.answer"),
    },
    {
      id: "faq.pivot.usage",
      category: "pivot",
      question: t("faq.pivot.usage.question"),
      answer: t("faq.pivot.usage.answer"),
    },
    {
      id: "faq.pivot.export",
      category: "pivot",
      question: t("faq.pivot.export.question"),
      answer: t("faq.pivot.export.answer"),
    },
    {
      id: "faq.pivot.saveConfig",
      category: "pivot",
      question: t("faq.pivot.saveConfig.question"),
      answer: t("faq.pivot.saveConfig.answer"),
    },
    {
      id: "faq.pivot.refresh",
      category: "pivot",
      question: t("faq.pivot.refresh.question"),
      answer: t("faq.pivot.refresh.answer"),
    },
    {
      id: "faq.pivot.zoom",
      category: "pivot",
      question: t("faq.pivot.zoom.question"),
      answer: t("faq.pivot.zoom.answer"),
    },
    {
      id: "faq.data.sources",
      category: "data",
      question: t("faq.data.sources.question"),
      answer: t("faq.data.sources.answer"),
    },
    {
      id: "faq.data.updates",
      category: "data",
      question: t("faq.data.updates.question"),
      answer: t("faq.data.updates.answer"),
    },
    {
      id: "faq.data.filters",
      category: "data",
      question: t("faq.data.filters.question"),
      answer: t("faq.data.filters.answer"),
    },
    {
      id: "faq.technical.browsers",
      category: "technical",
      question: t("faq.technical.browsers.question"),
      answer: t("faq.technical.browsers.answer"),
    },
    {
      id: "faq.technical.troubleshoot",
      category: "technical",
      question: t("faq.technical.troubleshoot.question"),
      answer: t("faq.technical.troubleshoot.answer"),
    },
    {
      id: "faq.technical.security",
      category: "technical",
      question: t("faq.technical.security.question"),
      answer: t("faq.technical.security.answer"),
    },
    {
      id: "faq.account.password",
      category: "account",
      question: t("faq.account.password.question"),
      answer: t("faq.account.password.answer"),
    },
    {
      id: "faq.account.locked",
      category: "account",
      question: t("faq.account.locked.question"),
      answer: t("faq.account.locked.answer"),
    },
  ];

  const filteredFaqs = faqItems.filter(
    (item) =>
      (activeCategory === "all" || item.category === activeCategory) &&
      (searchQuery === "" ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = [
    { id: "all", label: t("faq.categories.all") },
    { id: "general", label: t("faq.categories.general") },
    { id: "pivot", label: t("faq.categories.pivot") },
    { id: "data", label: t("faq.categories.data") },
    { id: "technical", label: t("faq.categories.technical") },
    { id: "account", label: t("faq.categories.account") },
  ];

  const headerAction = (
    <Box sx={{ display: "flex" }}>
      <Button
        startIcon={<ExpandAllIcon />}
        onClick={handleExpandAll}
        sx={{ mr: 1 }}
      >
        {t("faq.expandAll")}
      </Button>
      <Button startIcon={<CollapseAllIcon />} onClick={handleCollapseAll}>
        {t("faq.collapseAll")}
      </Button>
    </Box>
  );

  return (
    <PageLayout
      title={t("faq.frequentlyAskedQuestions")}
      subtitle={t("faq.findAnswers")}
      headerAction={headerAction}
    >
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder={t("faq.searchFAQ")}
          value={searchQuery}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: "flex", mb: 3 }}>
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              onClick={() => handleCategoryChange(category.id)}
              color={activeCategory === category.id ? "primary" : "default"}
              sx={{ mr: 1, mb: 1 }}
            />
          ))}
        </Box>
      </Box>

      {filteredFaqs.length === 0 ? (
        <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
          {t("faq.noResults")}
        </Typography>
      ) : (
        filteredFaqs.map((faq) => (
          <Accordion
            key={faq.id}
            expanded={expanded === faq.id || expanded === "all"}
            onChange={handleChange(faq.id)}
            sx={{ mb: 2 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`${faq.id}-content`}
              id={`${faq.id}-header`}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {faq.question}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body1">{faq.answer}</Typography>
              <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                <Typography variant="body2" color="text.secondary">
                  {t("faq.helpfulAnswer")}
                </Typography>
                <Button size="small" sx={{ ml: 1 }}>
                  {t("faq.yes")}
                </Button>
                <Button size="small">{t("faq.no")}</Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      <Divider sx={{ my: 4 }} />

      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          {t("faq.moreQuestions")}
        </Typography>
        <Button variant="contained" color="primary">
          {t("faq.contactSupport")}
        </Button>
      </Box>
    </PageLayout>
  );
};

export default FAQ;
